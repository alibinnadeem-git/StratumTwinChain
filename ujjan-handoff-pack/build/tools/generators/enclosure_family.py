#!/usr/bin/env python3
"""enclosure_family.py -- parametric GLB generator for the STRATUM enclosure family.

Covers taxonomy rows E-02..E-07, E-11 and E-12 (panelboards, switchboards,
switchgear line-ups, motor control centres, disconnect switches and enclosed
circuit breakers). One generator, many rows, as the build spec intends.

Output per model (STRATUM Intake Gate, Deliverable 1):
  * <name>.glb        -- glTF 2.0 binary, +Y up, metres, front +Z
  * <name>.meta.json  -- sidecar registration metadata (brief s4)

Design rules honoured (handoff brief s5):
  * No OEM geometry. These are in-house generic solids. In-house models may
    follow manufacturer-*published* dimensions -- dimensions are facts, mesh
    is theirs. Nothing here is traced/converted/re-meshed from vendor CAD.
  * No guessed dimensions. Every dimension is an explicit parameter with a
    documented default. Defaults follow published envelope standards:
      - Panelboards / load centres: NEMA PB 1, UL 67 enclosure envelopes.
      - LV switchgear: ANSI/IEEE C37.20.1 (section ~0.6-0.9 m W, ~2.3 m H).
      - MV metal-clad switchgear: ANSI/IEEE C37.20.2.
      - Switchboards: UL 891.
      - Motor control centres: NEMA ICS 18 / UL 845 (20"/0.508 m sections,
        90"/2.286 m high, 6" bucket space-factor increments).
      - Safety switches / enclosed breakers: NEMA 250 / UL 50 enclosures.
    These are published *envelope* figures, not any single SKU's drawing.
    Override any of them on the command line; nothing is hidden-guessed.
  * Canonical frame is Z-up metres (IFC/BIM); the GLB itself is +Y up per the
    glTF convention and the viewer applies the single Y-up conversion at its
    root. This file authors directly in the glTF +Y-up metre frame.

v0.2.0 adds visual differentiation so a reviewer can tell the gear apart:
  - MV switchgear (E-02): stacked instrument / breaker / cable compartments.
  - LV switchgear (E-03): a column of drawout breaker cells per section.
  - Switchboard (E-04): a main-breaker section plus grouped distribution doors.
  - De-glossed ANSI-61 painted-steel finish, section-divider ribs, roof caps,
    ventilation louvers, nameplates and door hinges.

Frame used by every model:
    X = width  (centred: x in [-W/2, +W/2])
    Y = height (up:      y in [0, H], origin at the floor/bottom plane)
    Z = depth  (front +Z: z in [0, D], back face z=0 sits against the wall)

Dependencies: Python 3.8+, numpy. Standard library otherwise. No network.

Usage:
    python enclosure_family.py --all --out DIR          # curated family + manifest
    python enclosure_family.py --type-id E-06 --variant panelboard \
        --name branch_panelboard_500x1000 --width 0.5 --height 1.0 --depth 0.15 \
        --out DIR
"""

import argparse
import hashlib
import json
import os
import struct

import numpy as np

VERSION = "0.2.0"
GENERATOR = "enclosure_family.py v%s" % VERSION

# glTF constants
_FLOAT = 5126
_UINT = 5125
_ARRAY_BUFFER = 34962
_ELEMENT_ARRAY_BUFFER = 34963
_TRIANGLES = 4
_MAGIC = b"glTF"
_JSON_CHUNK = 0x4E4F534A
_BIN_CHUNK = 0x004E4942

# ---------------------------------------------------------------------------
# Finishes (PBR base colours). ANSI-61 light grey is the switchgear default,
# toned down and matte so it reads as painted steel rather than glossy white.
# ---------------------------------------------------------------------------
FINISHES = {
    "ansi-61-grey": (0.60, 0.61, 0.59),
    "ral-7035-grey": (0.80, 0.81, 0.80),
    "white": (0.90, 0.90, 0.90),
}


# ---------------------------------------------------------------------------
# Geometry accumulator: collects flat-shaded boxes grouped by material.
# ---------------------------------------------------------------------------
class Geo:
    def __init__(self):
        # material_key -> {"pos": [], "nrm": [], "idx": []}
        self.groups = {}

    def _grp(self, mat):
        return self.groups.setdefault(mat, {"pos": [], "nrm": [], "idx": []})

    def add_box(self, mat, mn, mx):
        """Add an axis-aligned box from min corner mn to max corner mx."""
        x0, y0, z0 = mn
        x1, y1, z1 = mx
        faces = [
            ((0, 0, 1), [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]),   # +Z front
            ((0, 0, -1), [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)]),  # -Z back
            ((1, 0, 0), [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)]),   # +X right
            ((-1, 0, 0), [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)]),  # -X left
            ((0, 1, 0), [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)]),   # +Y top
            ((0, -1, 0), [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]),  # -Y bottom
        ]
        g = self._grp(mat)
        for normal, quad in faces:
            base = len(g["pos"])
            g["pos"].extend(quad)
            g["nrm"].extend([normal] * 4)
            g["idx"].extend([base, base + 1, base + 2, base, base + 2, base + 3])

    def global_bounds(self):
        allpos = []
        for g in self.groups.values():
            allpos.extend(g["pos"])
        arr = np.asarray(allpos, dtype=np.float32)
        return arr.min(axis=0), arr.max(axis=0)


# ---------------------------------------------------------------------------
# Material palette per finish. Keys are (name, rgb) tuples used as group keys.
# ---------------------------------------------------------------------------
def _mats(finish):
    return {
        "body": ("body", finish),
        "door": ("door", tuple(c * 0.93 for c in finish)),
        "hw": ("hw", (0.46, 0.47, 0.49)),       # handles / hinges: brushed steel
        "base": ("base", (0.19, 0.19, 0.21)),    # plinth / divider ribs: dark
        "vent": ("vent", (0.10, 0.10, 0.11)),    # louver slots: near-black recess
        "plate": ("plate", (0.80, 0.80, 0.82)),  # nameplate: light metal
    }


# ---------------------------------------------------------------------------
# Door + detail helpers
# ---------------------------------------------------------------------------
def _add_nameplate(geo, m, x0, x1, y1, face):
    w = min(0.14, (x1 - x0) * 0.5)
    h = 0.042
    cx = (x0 + x1) / 2.0
    cy = y1 - max(0.06, (y1 - 0) * 0.0) - h  # just below the top edge
    cy = y1 - 0.055
    geo.add_box(m["plate"], (cx - w / 2, cy - h / 2, face), (cx + w / 2, cy + h / 2, face + 0.005))


def _add_vents(geo, m, x0, x1, y_center, face, slots=4, slot_h=0.010, gap=0.012):
    inset = min(0.05, (x1 - x0) * 0.18)
    total = slots * slot_h + (slots - 1) * gap
    y = y_center - total / 2
    for _ in range(slots):
        # recessed dark slot sitting just behind the door face
        geo.add_box(m["vent"], (x0 + inset, y, face - 0.006), (x1 - inset, y + slot_h, face - 0.001))
        y += slot_h + gap


def _door(geo, m, x0, x1, y0, y1, zf, handle="right",
          nameplate=True, vents=False, hinges=True, proud=0.015):
    """A proud door panel with optional handle, hinges, nameplate and louvers."""
    geo.add_box(m["door"], (x0, y0, zf), (x1, y1, zf + proud))
    face = zf + proud
    ymid = (y0 + y1) / 2.0
    hh = min(0.14, (y1 - y0) * 0.33)
    hw = 0.022
    if handle == "right":
        hx1 = x1 - 0.02
        hx0 = hx1 - hw
        hinge_x = x0
    elif handle == "left":
        hx0 = x0 + 0.02
        hx1 = hx0 + hw
        hinge_x = x1
    else:
        hx0 = None
        hinge_x = None
    if hx0 is not None:
        geo.add_box(m["hw"], (hx0, ymid - hh / 2, face), (hx1, ymid + hh / 2, face + 0.026))
    if hinges and hinge_x is not None:
        for fy in (0.16, 0.84):
            yc = y0 + (y1 - y0) * fy
            if handle == "right":
                hx = (hinge_x - 0.004, hinge_x + 0.012)
            else:
                hx = (hinge_x - 0.012, hinge_x + 0.004)
            geo.add_box(m["hw"], (hx[0], yc - 0.028, face - 0.004), (hx[1], yc + 0.028, face + 0.006))
    if nameplate and (y1 - y0) > 0.14:
        _add_nameplate(geo, m, x0, x1, y1, face)
    if vents and (y1 - y0) > 0.2:
        _add_vents(geo, m, x0, x1, y0 + (y1 - y0) * 0.3, face)


def _structure(geo, m, W, H, D, sections, base_h, roof=True):
    """Base plinth, cabinet body, inter-section divider ribs and a roof cap."""
    zf = D
    geo.add_box(m["base"], (-W / 2, 0, 0), (W / 2, base_h, D))
    geo.add_box(m["body"], (-W / 2, base_h, 0), (W / 2, H, D))
    sw = W / sections
    for i in range(1, sections):
        x = -W / 2 + i * sw
        geo.add_box(m["base"], (x - 0.012, base_h, zf - 0.004), (x + 0.012, H - 0.02, zf + 0.02))
    if roof:
        geo.add_box(m["body"], (-W / 2 - 0.02, H, -0.02), (W / 2 + 0.02, H + 0.035, D + 0.03))


# ---------------------------------------------------------------------------
# Variant builders. Each returns (Geo, anchors, origin_label).
# ---------------------------------------------------------------------------
def build_panelboard(p):
    """E-05 / E-06 -- wall-mounted panelboard / load centre. One door."""
    W, H, D = p["width_m"], p["height_m"], p["depth_m"]
    m = _mats(FINISHES.get(p.get("finish"), FINISHES["ansi-61-grey"]))
    geo = Geo()
    geo.add_box(m["body"], (-W / 2, 0, 0), (W / 2, H, D))
    inset = min(0.03, W * 0.12)
    _door(geo, m, -W / 2 + inset, W / 2 - inset, inset, H - inset, D,
          handle="right", nameplate=True, vents=False, hinges=True)
    anchors = {
        "mount_face": (0.0, H / 2, 0.0),
        "power_in": (0.0, H, D / 2),
        "conduit_entry": (-W * 0.25, H, D / 2),
        "ground_lug": (0.0, 0.08, D * 0.85),
    }
    return geo, anchors, "wall face"


def build_switchgear(p):
    """E-02 / E-03 / E-04 -- floor-standing line-up of vertical sections.

    Styled by `style`:
      mv          -- instrument (top) / breaker (mid) / cable (bottom) compartments
      lv          -- a column of drawout breaker cells per section
      switchboard -- main-breaker section + grouped distribution doors
    """
    W, H, D = p["width_m"], p["height_m"], p["depth_m"]
    sections = max(1, int(p.get("sections", 2)))
    style = p.get("style", "lv")
    m = _mats(FINISHES.get(p.get("finish"), FINISHES["ansi-61-grey"]))
    geo = Geo()
    base_h = min(0.1, H * 0.06)
    _structure(geo, m, W, H, D, sections, base_h, roof=True)
    zf = D
    sw = W / sections
    inset = 0.03
    top = H - inset
    bottom = base_h + inset
    span = top - bottom
    gap = 0.014

    def cell(i, y0, y1, **kw):
        sx0 = -W / 2 + i * sw + inset
        sx1 = -W / 2 + (i + 1) * sw - inset
        _door(geo, m, sx0, sx1, y0, y1, zf, **kw)

    for i in range(sections):
        if style == "mv":
            h_instr = span * 0.18
            h_breaker = span * 0.46
            y_top = top
            cell(i, y_top - h_instr, y_top, handle="left", nameplate=True, vents=False)
            y2 = y_top - h_instr - gap
            cell(i, y2 - h_breaker, y2, handle="right", nameplate=True, vents=True)
            y3 = y2 - h_breaker - gap
            cell(i, bottom, y3, handle="right", nameplate=False, vents=True)
        elif style == "switchboard":
            if i == 0:
                h_meter = span * 0.16
                cell(i, top - h_meter, top, handle="left", nameplate=True, vents=False)
                cell(i, bottom, top - h_meter - gap, handle="right", nameplate=True, vents=True)
            else:
                half = (span - gap) / 2
                cell(i, top - half, top, handle="right", nameplate=True, vents=False)
                cell(i, bottom, bottom + half, handle="right", nameplate=True, vents=False)
        else:  # lv drawout cells
            cells = max(2, int(p.get("cells_per_section", 4)))
            ch = (span - gap * (cells - 1)) / cells
            for j in range(cells):
                y0 = bottom + j * (ch + gap)
                cell(i, y0, y0 + ch, handle="left" if j % 2 else "right",
                     nameplate=True, vents=(j == 0))

    anchors = {
        "mount_face": (0.0, 0.0, D / 2),
        "power_in": (0.0, H, D * 0.25),
        "ground_lug": (0.0, base_h + 0.05, D * 0.9),
    }
    return geo, anchors, "floor"


def build_mcc(p):
    """E-07 -- motor control centre: vertical sections split into bucket doors."""
    W, H, D = p["width_m"], p["height_m"], p["depth_m"]
    sections = max(1, int(p.get("sections", 2)))
    buckets = max(1, int(p.get("buckets_per_section", 5)))
    m = _mats(FINISHES.get(p.get("finish"), FINISHES["ansi-61-grey"]))
    geo = Geo()
    base_h = min(0.1, H * 0.05)
    _structure(geo, m, W, H, D, sections, base_h, roof=True)
    zf = D
    sw = W / sections
    inset = 0.025
    bus_h = (H - base_h) * 0.12          # top horizontal bus / pull-box band
    bucket_zone_top = H - bus_h
    bh = (bucket_zone_top - base_h - inset) / buckets
    for i in range(sections):
        sx0 = -W / 2 + i * sw + inset
        sx1 = -W / 2 + (i + 1) * sw - inset
        # labelled top bus compartment door
        _door(geo, m, sx0, sx1, bucket_zone_top, H - inset, zf,
              handle="left", nameplate=True, vents=True, hinges=True)
        for j in range(buckets):
            by0 = base_h + inset + j * bh
            by1 = by0 + bh - 0.012
            _door(geo, m, sx0, sx1, by0, by1, zf, handle="left",
                  nameplate=False, vents=False, hinges=True)
    anchors = {
        "mount_face": (0.0, 0.0, D / 2),
        "power_in": (0.0, H, D * 0.3),
        "ground_lug": (0.0, base_h + 0.05, D * 0.9),
    }
    return geo, anchors, "floor"


def build_disconnect(p):
    """E-11 -- wall-mounted safety switch with a side operating handle."""
    W, H, D = p["width_m"], p["height_m"], p["depth_m"]
    m = _mats(FINISHES.get(p.get("finish"), FINISHES["ral-7035-grey"]))
    geo = Geo()
    geo.add_box(m["body"], (-W / 2, 0, 0), (W / 2, H, D))
    inset = 0.02
    # cover panel (no latch handle; operator is on the side)
    geo.add_box(m["door"], (-W / 2 + inset, inset, D), (W / 2 - inset, H - inset, D + 0.012))
    _add_nameplate(geo, m, -W / 2 + inset, W / 2 - inset, H - inset, D + 0.012)
    # external operating handle on the +X side
    hy = H * 0.72
    geo.add_box(m["hw"], (W / 2, hy - 0.02, D * 0.35), (W / 2 + 0.03, hy + 0.09, D * 0.65))
    geo.add_box(m["hw"], (W / 2 + 0.03, hy - 0.02, D * 0.45), (W / 2 + 0.085, hy + 0.02, D * 0.55))
    anchors = {
        "mount_face": (0.0, H / 2, 0.0),
        "power_in": (0.0, H, D / 2),
        "conduit_entry": (0.0, 0.0, D / 2),
        "ground_lug": (W * 0.3, 0.06, D * 0.8),
    }
    return geo, anchors, "wall face"


def build_enclosed_breaker(p):
    """E-12 -- wall-mounted enclosed circuit breaker, front toggle handle."""
    W, H, D = p["width_m"], p["height_m"], p["depth_m"]
    m = _mats(FINISHES.get(p.get("finish"), FINISHES["ansi-61-grey"]))
    geo = Geo()
    geo.add_box(m["body"], (-W / 2, 0, 0), (W / 2, H, D))
    inset = 0.025
    zf = D
    geo.add_box(m["door"], (-W / 2 + inset, inset, zf), (W / 2 - inset, H - inset, zf + 0.014))
    _add_nameplate(geo, m, -W / 2 + inset, W / 2 - inset, H - inset, zf + 0.014)
    mat_toggle = ("vent", (0.10, 0.10, 0.11))
    geo.add_box(mat_toggle, (-0.03, H / 2 - 0.05, zf + 0.014), (0.03, H / 2 + 0.05, zf + 0.05))
    anchors = {
        "mount_face": (0.0, H / 2, 0.0),
        "power_in": (0.0, H, D / 2),
        "conduit_entry": (0.0, 0.0, D / 2),
        "ground_lug": (W * 0.3, 0.06, D * 0.8),
    }
    return geo, anchors, "wall face"


BUILDERS = {
    "panelboard": build_panelboard,
    "switchgear": build_switchgear,
    "switchboard": build_switchgear,
    "mcc": build_mcc,
    "disconnect": build_disconnect,
    "enclosed_breaker": build_enclosed_breaker,
}

# IFC4 class mapping per taxonomy row (BUILD-SPECS-REFERENCE s1, Electrical).
IFC_BY_TYPE = {
    "E-02": ("IfcElectricDistributionBoard", "SWITCHBOARD"),
    "E-03": ("IfcElectricDistributionBoard", "SWITCHBOARD"),
    "E-04": ("IfcElectricDistributionBoard", "SWITCHBOARD"),
    "E-05": ("IfcElectricDistributionBoard", "DISTRIBUTIONBOARD"),
    "E-06": ("IfcElectricDistributionBoard", "DISTRIBUTIONBOARD"),
    "E-07": ("IfcElectricDistributionBoard", "MOTORCONTROLCENTRE"),
    "E-11": ("IfcSwitchingDevice", "SWITCHDISCONNECTOR"),
    "E-12": ("IfcProtectiveDevice", "CIRCUITBREAKER"),
}


# ---------------------------------------------------------------------------
# GLB writer. Hand-rolled so we control every byte (needed for the masked
# sha256 patch and for glTF-Validator compliance: exact accessor min/max,
# bufferView targets, unit normals, 4-byte alignment).
# ---------------------------------------------------------------------------
def _material(name_rgb):
    name, rgb = name_rgb
    metallic, rough = 0.0, 0.8            # painted steel default (matte)
    if name == "hw":
        metallic, rough = 0.6, 0.45
    elif name == "base":
        metallic, rough = 0.2, 0.75
    elif name == "vent":
        metallic, rough = 0.3, 0.6
    elif name == "plate":
        metallic, rough = 0.7, 0.3
    return {
        "name": name,
        "doubleSided": True,
        "pbrMetallicRoughness": {
            "baseColorFactor": [rgb[0], rgb[1], rgb[2], 1.0],
            "metallicFactor": metallic,
            "roughnessFactor": rough,
        },
    }


def build_glb_bytes(geo, anchors, extras):
    """Assemble GLB bytes with a 64-char placeholder in extras['sha256']."""
    blob = bytearray()
    bufferViews = []
    accessors = []
    primitives = []
    materials = []
    mat_index = {}

    def add_view(data_bytes, target):
        while len(blob) % 4 != 0:
            blob.append(0)
        offset = len(blob)
        blob.extend(data_bytes)
        bufferViews.append({
            "buffer": 0, "byteOffset": offset,
            "byteLength": len(data_bytes), "target": target,
        })
        return len(bufferViews) - 1

    for mat_key, g in geo.groups.items():
        if mat_key not in mat_index:
            mat_index[mat_key] = len(materials)
            materials.append(_material(mat_key))
        pos = np.asarray(g["pos"], dtype=np.float32)
        nrm = np.asarray(g["nrm"], dtype=np.float32)
        idx = np.asarray(g["idx"], dtype=np.uint32)

        pv = add_view(pos.tobytes(), _ARRAY_BUFFER)
        pmin = [float(v) for v in pos.min(axis=0)]
        pmax = [float(v) for v in pos.max(axis=0)]
        pa = len(accessors)
        accessors.append({
            "bufferView": pv, "componentType": _FLOAT, "count": int(pos.shape[0]),
            "type": "VEC3", "min": pmin, "max": pmax,
        })
        nv = add_view(nrm.tobytes(), _ARRAY_BUFFER)
        na = len(accessors)
        accessors.append({
            "bufferView": nv, "componentType": _FLOAT, "count": int(nrm.shape[0]),
            "type": "VEC3",
        })
        iv = add_view(idx.tobytes(), _ELEMENT_ARRAY_BUFFER)
        ia = len(accessors)
        accessors.append({
            "bufferView": iv, "componentType": _UINT, "count": int(idx.shape[0]),
            "type": "SCALAR",
        })
        primitives.append({
            "attributes": {"POSITION": pa, "NORMAL": na},
            "indices": ia, "material": mat_index[mat_key], "mode": _TRIANGLES,
        })

    nodes = [{"name": "body", "mesh": 0}]
    for name, (x, y, z) in anchors.items():
        nodes.append({"name": name, "translation": [float(x), float(y), float(z)]})
    scene_nodes = list(range(len(nodes)))

    gltf = {
        "asset": {"version": "2.0", "generator": GENERATOR},
        "scene": 0,
        "scenes": [{"nodes": scene_nodes}],
        "nodes": nodes,
        "meshes": [{"name": "enclosure", "primitives": primitives}],
        "materials": materials,
        "accessors": accessors,
        "bufferViews": bufferViews,
        "buffers": [{"byteLength": len(blob)}],
        "extras": extras,
    }

    json_raw = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_raw += b" " * ((-len(json_raw)) % 4)
    bin_raw = bytes(blob) + b"\x00" * ((-len(blob)) % 4)
    total = 12 + 8 + len(json_raw) + 8 + len(bin_raw)
    out = bytearray()
    out += _MAGIC
    out += struct.pack("<I", 2)
    out += struct.pack("<I", total)
    out += struct.pack("<I", len(json_raw))
    out += struct.pack("<I", _JSON_CHUNK)
    out += json_raw
    out += struct.pack("<I", len(bin_raw))
    out += struct.pack("<I", _BIN_CHUNK)
    out += bin_raw
    assert len(out) == total
    return bytes(out)


def patch_masked_sha256(file_bytes):
    """Fill extras.sha256 using the detached-signature pattern the gate checks."""
    token = b'"sha256":"'
    i = file_bytes.find(token)
    if i < 0:
        raise RuntimeError("sha256 placeholder not found")
    start = i + len(token)
    end = start + 64
    if file_bytes[end:end + 1] != b'"':
        raise RuntimeError("sha256 placeholder is not 64 chars")
    masked = bytearray(file_bytes)
    masked[start:end] = b"\x00" * 64
    digest = hashlib.sha256(bytes(masked)).hexdigest()
    patched = bytearray(file_bytes)
    patched[start:end] = digest.encode("ascii")
    return bytes(patched), digest


# ---------------------------------------------------------------------------
# Model generation
# ---------------------------------------------------------------------------
def generate_model(spec, out_root):
    variant = spec["variant"]
    builder = BUILDERS[variant]
    geo, anchors, origin_label = builder(spec)

    gmin, gmax = geo.global_bounds()
    bounding = [round(float(gmax[k] - gmin[k]), 6) for k in range(3)]
    type_id = spec["type_id"]
    ifc_class, ifc_pt = IFC_BY_TYPE[type_id]

    params = {k: spec[k] for k in spec if k not in ("type_id", "variant", "name")}
    extras = {
        "type_id": type_id,
        "ifc_class": ifc_class,
        "ifc_predefined_type": ifc_pt,
        "source": "in-house-parametric",
        "licence_tier": "T1",
        "permission_ref": None,
        "sha256": "0" * 64,
        "bounding_dimensions": bounding,
        "scale_rule": "per-axis",
        "generator": GENERATOR,
        "normalization": {"up": "+Y", "origin": origin_label, "front": "+Z"},
        "params": params,
    }

    raw = build_glb_bytes(geo, anchors, extras)
    patched, digest = patch_masked_sha256(raw)

    model_dir = os.path.join(out_root, "assets", "library", "models", type_id)
    os.makedirs(model_dir, exist_ok=True)
    glb_path = os.path.join(model_dir, spec["name"] + ".glb")
    with open(glb_path, "wb") as f:
        f.write(patched)

    meta = {
        "type_id": type_id,
        "licence_tier": "T1",
        "permission_ref": None,
        "expected_anchors": list(anchors.keys()),
        "declared_up": "+Y",
        "declared_origin": origin_label,
        "declared_front": "+Z",
        "generator": GENERATOR,
        "params": params,
    }
    meta_path = glb_path[:-4] + ".meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    rel = os.path.relpath(glb_path, out_root).replace(os.sep, "/")
    return {
        "type_id": type_id, "path": rel, "sha256": digest,
        "licence_tier": "T1", "bounding_dimensions": bounding,
    }


# Curated family: one representative model per covered taxonomy row.
CURATED = [
    {"type_id": "E-02", "variant": "switchgear", "name": "mv_switchgear_2section",
     "width_m": 1.8, "height_m": 2.3, "depth_m": 1.5, "sections": 2,
     "style": "mv", "finish": "ansi-61-grey"},
    {"type_id": "E-03", "variant": "switchgear", "name": "lv_switchgear_3section",
     "width_m": 2.4, "height_m": 2.3, "depth_m": 1.5, "sections": 3,
     "style": "lv", "cells_per_section": 4, "finish": "ansi-61-grey"},
    {"type_id": "E-04", "variant": "switchboard", "name": "main_switchboard_2section",
     "width_m": 1.5, "height_m": 2.28, "depth_m": 0.9, "sections": 2,
     "style": "switchboard", "finish": "ansi-61-grey"},
    {"type_id": "E-05", "variant": "panelboard", "name": "distribution_panelboard_600x1800",
     "width_m": 0.6, "height_m": 1.8, "depth_m": 0.25, "finish": "ansi-61-grey"},
    {"type_id": "E-06", "variant": "panelboard", "name": "branch_panelboard_500x1000",
     "width_m": 0.5, "height_m": 1.0, "depth_m": 0.15, "finish": "ansi-61-grey"},
    {"type_id": "E-07", "variant": "mcc", "name": "mcc_2section_5bucket",
     "width_m": 1.0, "height_m": 2.286, "depth_m": 0.5, "sections": 2,
     "buckets_per_section": 5, "finish": "ansi-61-grey"},
    {"type_id": "E-11", "variant": "disconnect", "name": "disconnect_switch_60a",
     "width_m": 0.3, "height_m": 0.45, "depth_m": 0.18, "finish": "ral-7035-grey"},
    {"type_id": "E-12", "variant": "enclosed_breaker", "name": "enclosed_breaker_100a",
     "width_m": 0.3, "height_m": 0.5, "depth_m": 0.2, "finish": "ansi-61-grey"},
]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="out", help="output root (repo-mirrored tree)")
    ap.add_argument("--all", action="store_true", help="generate the curated family")
    ap.add_argument("--manifest", action="store_true",
                    help="write assets/library/models/manifest.json for generated models")
    ap.add_argument("--delivery", default="v2", help="delivery version tag for the manifest")
    ap.add_argument("--type-id")
    ap.add_argument("--variant", choices=sorted(BUILDERS.keys()))
    ap.add_argument("--name")
    ap.add_argument("--width", type=float)
    ap.add_argument("--height", type=float)
    ap.add_argument("--depth", type=float)
    ap.add_argument("--sections", type=int, default=2)
    ap.add_argument("--buckets-per-section", type=int, default=5)
    ap.add_argument("--cells-per-section", type=int, default=4)
    ap.add_argument("--style", choices=["mv", "lv", "switchboard"], default="lv")
    ap.add_argument("--finish", default="ansi-61-grey")
    args = ap.parse_args(argv)

    if args.all:
        specs = CURATED
    else:
        for req in ("type_id", "variant", "name", "width", "height", "depth"):
            if getattr(args, req) is None:
                ap.error("single-model mode needs --type-id --variant --name "
                         "--width --height --depth (or use --all)")
        specs = [{
            "type_id": args.type_id, "variant": args.variant, "name": args.name,
            "width_m": args.width, "height_m": args.height, "depth_m": args.depth,
            "sections": args.sections, "buckets_per_section": args.buckets_per_section,
            "cells_per_section": args.cells_per_section, "style": args.style,
            "finish": args.finish,
        }]

    entries = []
    for spec in specs:
        entry = generate_model(spec, args.out)
        entries.append(entry)
        print("wrote %s  (%.3f x %.3f x %.3f m)  sha256 %s"
              % (entry["path"], entry["bounding_dimensions"][0],
                 entry["bounding_dimensions"][1], entry["bounding_dimensions"][2],
                 entry["sha256"][:12]))

    if args.manifest or args.all:
        manifest = {
            "delivery": args.delivery,
            "generator": GENERATOR,
            "models": [{
                "type_id": e["type_id"], "path": e["path"], "sha256": e["sha256"],
                "licence_tier": e["licence_tier"], "gate": "pending",
            } for e in entries],
        }
        mpath = os.path.join(args.out, "assets", "library", "models", "manifest.json")
        os.makedirs(os.path.dirname(mpath), exist_ok=True)
        with open(mpath, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
        print("wrote %s (%d models)" % (
            os.path.relpath(mpath, args.out).replace(os.sep, "/"), len(entries)))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
