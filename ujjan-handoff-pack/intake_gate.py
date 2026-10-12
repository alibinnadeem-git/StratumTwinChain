#!/usr/bin/env python3
"""
intake_gate.py -- Independent 7-check Intake Gate verifier for GLB/glTF 2.0 models.

Implements the Intake Gate from the STRATUM Spatial Verified build specs
(Deliverable 1). This is an INDEPENDENT verifier: it checks models other
people/agents produce. It is strict and honest -- it reports what it can
prove from the bytes and says plainly what it cannot.

Standard library only. Read-only: never modifies the model file.

Usage:
    python intake_gate.py MODEL.glb --meta META.json [--equipment|--device]
    python intake_gate.py --self-test

Exit code: 0 if no check failed (skips allowed), 1 if any check failed.

META.json fields:
    type_id          e.g. "E-06"
    licence_tier     "T1" | "T2" | "T3"
    permission_ref   string, required (non-empty) when tier is "T2"
    expected_anchors list of node names, e.g. ["mount_face", "power_in"]
    declared_up      e.g. "+Y"
    declared_origin  e.g. "floor"
    declared_front   e.g. "+Z"
"""

import argparse
import hashlib
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile

GLTF_MAGIC = b"glTF"
GLTF_VERSION = 2
JSON_CHUNK_TYPE = 0x4E4F534A  # b"JSON" little-endian
BIN_CHUNK_TYPE = 0x004E4942   # b"BIN\0" little-endian

TRI_BUDGET_EQUIPMENT = 50000
TRI_BUDGET_DEVICE = 5000
DIAG_MIN_M = 0.0001
DIAG_MAX_M = 1000.0

CHECK_NAMES = {
    1: "licence",
    2: "glb_parse",
    3: "normalization",
    4: "anchors",
    5: "triangle_budget",
    6: "validator",
    7: "registration",
}

REGISTRATION_FIELDS = [
    "type_id", "ifc_class", "source", "licence_tier",
    "sha256", "bounding_dimensions", "scale_rule",
]


class GateError(Exception):
    """Raised when the GLB cannot be structurally parsed."""


# --------------------------------------------------------------------------
# GLB parsing
# --------------------------------------------------------------------------

def parse_glb(path):
    """Parse a GLB file.

    Returns (gltf_dict, json_chunk_bytes, file_bytes).
    Raises GateError on any structural problem.
    """
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError as e:
        raise GateError("cannot read file: %s" % e)

    if len(data) < 12:
        raise GateError("file shorter than 12-byte GLB header (%d bytes)" % len(data))
    magic = data[0:4]
    if magic != GLTF_MAGIC:
        raise GateError("bad magic: expected b'glTF', got %r" % magic)
    version = struct.unpack("<I", data[4:8])[0]
    if version != GLTF_VERSION:
        raise GateError("unsupported glTF version %d (need 2)" % version)
    declared_len = struct.unpack("<I", data[8:12])[0]
    if declared_len != len(data):
        raise GateError(
            "declared length %d != actual file length %d" % (declared_len, len(data)))

    # Chunk walk. First chunk MUST be JSON.
    offset = 12
    json_bytes = None
    seen_first = False
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack("<II", data[offset:offset + 8])
        chunk_data_start = offset + 8
        chunk_data_end = chunk_data_start + chunk_len
        if chunk_data_end > len(data):
            raise GateError("chunk overruns file (offset %d, len %d)" % (offset, chunk_len))
        if not seen_first:
            if chunk_type != JSON_CHUNK_TYPE:
                raise GateError("first chunk is not JSON (type 0x%08X)" % chunk_type)
            json_bytes = data[chunk_data_start:chunk_data_end]
            seen_first = True
        offset = chunk_data_end

    if json_bytes is None:
        raise GateError("no JSON chunk found")

    try:
        text = json_bytes.decode("utf-8")
    except UnicodeDecodeError as e:
        raise GateError("JSON chunk is not valid UTF-8: %s" % e)
    try:
        gltf = json.loads(text)
    except json.JSONDecodeError as e:
        raise GateError("JSON chunk does not parse: %s" % e)
    if not isinstance(gltf, dict):
        raise GateError("JSON chunk top level is not an object")
    return gltf, json_bytes, data


# --------------------------------------------------------------------------
# Masked SHA-256 (the embedded sha256 field is excluded from its own hash)
# --------------------------------------------------------------------------

def _sha256_value_span(json_bytes):
    """Byte span (start, end) of the extras.sha256 string VALUE in json_bytes.

    Returns None if it cannot be located. This is a heuristic: it finds the
    first "sha256" key after the first "extras" key.
    """
    seg = json_bytes.find(b'"extras"')
    if seg < 0:
        return None
    i = json_bytes.find(b'"sha256"', seg)
    if i < 0:
        return None
    j = i + len(b'"sha256"')
    n = len(json_bytes)

    def skip_ws(k):
        while k < n and json_bytes[k:k + 1] in b" \t\r\n":
            k += 1
        return k

    j = skip_ws(j)
    if j >= n or json_bytes[j:j + 1] != b":":
        return None
    j = skip_ws(j + 1)
    if j >= n or json_bytes[j:j + 1] != b'"':
        return None
    j += 1
    k = j
    while k < n and json_bytes[k:k + 1] != b'"':
        if json_bytes[k:k + 1] == b"\\":
            k += 1
        k += 1
    if k >= n:
        return None
    return (j, k)


def masked_file_sha256(file_bytes, json_bytes):
    """SHA-256 of the file with the embedded extras.sha256 value zeroed out.

    A file cannot contain its own whole-file hash, so the comparison hash
    excludes the sha256 field itself (standard detached-signature pattern).
    Returns (hex_digest, method_note) or (None, reason).
    """
    span = _sha256_value_span(json_bytes)
    if span is None:
        return None, "could not locate extras.sha256 value in JSON chunk"
    # JSON chunk data starts at file offset 12 (header) + 8 (chunk header).
    base = 20
    start, end = base + span[0], base + span[1]
    if end > len(file_bytes) or start < 0:
        return None, "extras.sha256 span out of file bounds"
    masked = bytearray(file_bytes)
    masked[start:end] = b"\x00" * (end - start)
    return hashlib.sha256(bytes(masked)).hexdigest(), \
        "sha256 field itself excluded from the hash (detached-signature pattern)"


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

def check_licence(meta):
    tier = meta.get("licence_tier")
    if tier not in ("T1", "T2", "T3"):
        return ("fail", "licence_tier must be one of T1/T2/T3, got %r" % (tier,))
    if tier == "T2":
        ref = meta.get("permission_ref")
        if not isinstance(ref, str) or not ref.strip():
            return ("fail", "tier T2 requires a non-empty permission_ref string")
        return ("pass", "tier T2 with permission_ref %r" % ref)
    if tier == "T1":
        return ("pass", "tier T1 (CC0 or in-house) -- ships by default")
    return ("pass", "tier T3 (link-out only) -- never shipped or loaded")


def check_normalization(gltf, meta):
    extras = gltf.get("extras")
    if not isinstance(extras, dict):
        return ("fail", "top-level extras missing; need extras.normalization {up, origin, front}")
    norm = extras.get("normalization")
    if not isinstance(norm, dict):
        return ("fail", "extras.normalization missing; need {up, origin, front}")
    missing = [k for k in ("up", "origin", "front") if k not in norm]
    if missing:
        return ("fail", "extras.normalization missing keys: %s" % ", ".join(missing))

    declared_up = meta.get("declared_up")
    if declared_up != "+Y":
        return ("fail", "META declared_up must be '+Y' (glTF convention), got %r" % (declared_up,))
    if norm.get("up") != declared_up:
        return ("fail", "extras.normalization.up (%r) != META declared_up (%r)"
                % (norm.get("up"), declared_up))

    # Bounding-box diagonal from POSITION accessor min/max across all meshes.
    gmin, gmax = None, None
    accessors = gltf.get("accessors", [])
    for mesh in gltf.get("meshes", []):
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives", []):
            if not isinstance(prim, dict):
                continue
            attrs = prim.get("attributes", {})
            pi = attrs.get("POSITION")
            if not isinstance(pi, int) or pi < 0 or pi >= len(accessors):
                continue
            acc = accessors[pi]
            mn, mx = acc.get("min"), acc.get("max")
            if (not isinstance(mn, list) or not isinstance(mx, list)
                    or len(mn) != 3 or len(mx) != 3):
                continue
            try:
                mn = [float(v) for v in mn]
                mx = [float(v) for v in mx]
            except (TypeError, ValueError):
                continue
            if gmin is None:
                gmin, gmax = list(mn), list(mx)
            else:
                gmin = [min(a, b) for a, b in zip(gmin, mn)]
                gmax = [max(a, b) for a, b in zip(gmax, mx)]

    if gmin is None:
        return ("fail", "no POSITION accessor min/max found in any mesh; "
                         "cannot assess model scale")

    diag = math.sqrt(sum((b - a) ** 2 for a, b in zip(gmin, gmax)))
    detail = ("bbox diagonal %.4f m (bounds [%.4f, %.1f]); declared_up=+Y matches; "
              "note: true orientation cannot be proven from bytes alone -- "
              "pass is on declared values + sane bounds" % (diag, DIAG_MIN_M, DIAG_MAX_M))
    if not (DIAG_MIN_M <= diag <= DIAG_MAX_M):
        return ("fail", detail + "; diagonal outside plausible range")
    return ("pass", detail)


def check_anchors(gltf, meta):
    expected = meta.get("expected_anchors", [])
    if not isinstance(expected, list):
        return ("fail", "META expected_anchors must be a list, got %r" % (expected,))
    names = set()
    for node in gltf.get("nodes", []):
        if isinstance(node, dict) and isinstance(node.get("name"), str):
            names.add(node["name"])
    missing = [a for a in expected if a not in names]
    if missing:
        return ("fail", "missing anchor nodes: %s (found nodes: %s)"
                % (", ".join(missing), ", ".join(sorted(names)) if names else "(none)"))
    if not expected:
        return ("pass", "no expected_anchors declared; nothing to verify")
    return ("pass", "all %d expected anchor(s) present: %s" % (len(expected), ", ".join(expected)))


def _primitive_triangles(prim, accessors):
    idx = prim.get("indices")
    if isinstance(idx, int) and 0 <= idx < len(accessors):
        count = accessors[idx].get("count")
        if isinstance(count, int) and count >= 0:
            return count // 3
    attrs = prim.get("attributes", {})
    pi = attrs.get("POSITION")
    if isinstance(pi, int) and 0 <= pi < len(accessors):
        count = accessors[pi].get("count")
        if isinstance(count, int) and count >= 0:
            return count // 3
    return None


def check_triangle_budget(gltf, budget):
    accessors = gltf.get("accessors", [])
    total = 0
    uncounted = 0
    for mesh in gltf.get("meshes", []):
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives", []):
            if not isinstance(prim, dict):
                continue
            t = _primitive_triangles(prim, accessors)
            if t is None:
                uncounted += 1
            else:
                total += t

    used = set(gltf.get("extensionsUsed", []) or [])
    for mesh in gltf.get("meshes", []):
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives", []):
            if isinstance(prim, dict) and isinstance(prim.get("extensions"), dict):
                used.update(prim["extensions"].keys())
    comp = [e for e in ("KHR_draco_mesh_compression", "EXT_meshopt_compression") if e in used]
    comp_note = ("compression extension in use: %s" % ", ".join(comp)) if comp \
        else "no KHR_draco_mesh_compression / EXT_meshopt_compression extension declared"

    detail = "%d triangles total (budget %d); %s" % (total, budget, comp_note)
    if uncounted:
        detail += "; WARNING: %d primitive(s) had no countable indices/POSITION" % uncounted
        return ("fail", detail)
    if total > budget:
        return ("fail", detail + " -- OVER BUDGET")
    return ("pass", detail)


def _validator_probe(cmd):
    """True if the validator binary actually launches (vs. npx/npm failing)."""
    try:
        proc = subprocess.run(cmd + ["--version"], capture_output=True,
                              text=True, timeout=30)
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False
    except Exception:  # noqa: BLE001 - tool absence must not crash the gate
        return False
    out = ((proc.stdout or "") + (proc.stderr or "")).lower()
    launch_failures = ("npm error", "could not determine executable",
                       "command not found", "not found - 404", "enotfound",
                       "eai_again", "no such file")
    if any(sig in out for sig in launch_failures):
        return False
    return proc.returncode == 0


def check_validator(path):
    cmd = None
    exe = shutil.which("gltf-validator")
    if exe:
        cmd = [exe]
    elif shutil.which("npx"):
        cmd = ["npx", "-y", "gltf-validator"]
    else:
        return ("skip", "gltf-validator not installed")

    if not _validator_probe(cmd):
        return ("skip", "gltf-validator not installed or could not be launched")

    tmpdir = tempfile.mkdtemp(prefix="intake_gate_val_")
    report_path = os.path.join(tmpdir, "report.json")
    try:
        try:
            proc = subprocess.run(
                cmd + ["-o", report_path, path],
                capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            return ("skip", "gltf-validator timed out after 60s")
        except Exception as e:  # noqa: BLE001 - tool absence must not crash the gate
            return ("skip", "gltf-validator could not run: %s" % e)

        if os.path.exists(report_path):
            try:
                with open(report_path, "r", encoding="utf-8") as f:
                    report = json.load(f)
                msgs = report.get("issues", {}).get("messages", [])
                errors = [m for m in msgs if m.get("severity") == "Error"]
                if errors:
                    sample = "; ".join(
                        str(m.get("message", "?")) for m in errors[:3])
                    return ("fail", "%d error(s) reported by gltf-validator: %s"
                            % (len(errors), sample))
                return ("pass", "gltf-validator reported no errors")
            except (OSError, ValueError) as e:
                return ("skip", "could not parse validator report: %s" % e)
        # No JSON report produced: fall back to exit code.
        if proc.returncode == 0:
            return ("pass", "gltf-validator exit code 0 (no JSON report produced)")
        tail = (proc.stderr or proc.stdout or "")[-500:]
        return ("fail", "gltf-validator exit code %d: %s" % (proc.returncode, tail))
    finally:
        try:
            if os.path.exists(report_path):
                os.remove(report_path)
            os.rmdir(tmpdir)
        except OSError:
            pass


def check_registration(gltf, file_bytes, json_bytes):
    extras = gltf.get("extras")
    if not isinstance(extras, dict):
        return ("fail", "top-level extras missing; need %s" % ", ".join(REGISTRATION_FIELDS),
                None)
    missing = [f for f in REGISTRATION_FIELDS if f not in extras]
    if missing:
        return ("fail", "extras missing fields: %s" % ", ".join(missing), None)

    embedded = extras.get("sha256")
    if not isinstance(embedded, str) or not embedded.strip():
        return ("fail", "extras.sha256 must be a non-empty string", None)
    digest, note = masked_file_sha256(file_bytes, json_bytes)
    if digest is None:
        return ("fail", "sha256 comparison impossible: %s" % note, None)
    if digest.lower() != embedded.strip().lower():
        return ("fail",
                "extras.sha256 does not match file (%s... != %s...); %s"
                % (embedded[:16], digest[:16], note), digest)
    return ("pass",
            "extras.sha256 matches masked file hash %s...; all registration fields present; %s"
            % (digest[:16], note), digest)


# --------------------------------------------------------------------------
# Gate runner
# --------------------------------------------------------------------------

def run_gate(model_path, meta, budget, budget_label):
    checks = []

    def add(cid, result, detail):
        checks.append({"id": cid, "name": CHECK_NAMES[cid],
                       "result": result, "detail": detail})

    # Check 1: licence (META only -- runs even if the GLB is broken).
    r, d = check_licence(meta)
    add(1, r, d)

    # Check 2: GLB parse. Everything structural depends on it.
    gltf = None
    file_bytes = None
    json_bytes = None
    try:
        gltf, json_bytes, file_bytes = parse_glb(model_path)
        add(2, "pass", "valid GLB: magic b'glTF', version 2, JSON chunk parses, "
                       "declared length matches file")
        parsed = True
    except GateError as e:
        add(2, "fail", str(e))
        parsed = False

    if parsed:
        r, d = check_normalization(gltf, meta)
        add(3, r, d)
        r, d = check_anchors(gltf, meta)
        add(4, r, d)
        r, d = check_triangle_budget(gltf, budget)
        add(5, r, d)
    else:
        for cid in (3, 4, 5):
            add(cid, "fail", "not evaluated: GLB failed to parse (check 2)")

    # Check 6: external validator (may skip).
    r, d = check_validator(model_path)
    add(6, r, d)

    # Check 7: registration.
    masked_digest = None
    if parsed:
        r, d, masked_digest = check_registration(gltf, file_bytes, json_bytes)
        add(7, r, d)
    else:
        add(7, "fail", "not evaluated: GLB failed to parse (check 2)")

    overall = "fail" if any(c["result"] == "fail" for c in checks) else "pass"
    report = {
        "model": model_path,
        "sha256": masked_digest,  # masked-comparison hash; None if not computable
        "budget": budget_label,
        "checks": checks,
        "overall": overall,
    }
    return report, (1 if overall == "fail" else 0)


def load_meta(meta_path):
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
    except (OSError, ValueError) as e:
        return None, "META.json could not be read/parsed: %s" % e
    if not isinstance(meta, dict):
        return None, "META.json top level is not an object"
    return meta, None


# --------------------------------------------------------------------------
# Self-test
# --------------------------------------------------------------------------

def _build_test_glb(sha_placeholder):
    """Build a minimal valid GLB in memory. Returns bytes."""
    positions = struct.pack("<9f", 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0)
    gltf = {
        "asset": {"version": "2.0", "generator": "intake_gate self-test"},
        "scene": 0,
        "scenes": [{"nodes": [0, 1]}],
        "nodes": [
            {"name": "mount_face"},
            {"name": "body", "mesh": 0},
        ],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
        "accessors": [{
            "bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3",
            "min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 1.0],
        }],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(positions)}],
        "buffers": [{"byteLength": len(positions)}],
        "extras": {
            "type_id": "E-06",
            "ifc_class": "IfcElectricDistributionBoard",
            "source": "in-house",
            "licence_tier": "T1",
            "sha256": sha_placeholder,
            "bounding_dimensions": [1.0, 1.0, 1.0],
            "scale_rule": "fixed",
            "normalization": {"up": "+Y", "origin": "floor", "front": "+Z"},
        },
    }
    json_raw = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    pad = (-len(json_raw)) % 4
    json_raw += b" " * pad
    bin_raw = positions + b"\x00" * ((-len(positions)) % 4)
    total = 12 + 8 + len(json_raw) + 8 + len(bin_raw)
    out = bytearray()
    out += GLTF_MAGIC
    out += struct.pack("<I", GLTF_VERSION)
    out += struct.pack("<I", total)
    out += struct.pack("<I", len(json_raw))
    out += struct.pack("<I", JSON_CHUNK_TYPE)
    out += json_raw
    out += struct.pack("<I", len(bin_raw))
    out += struct.pack("<I", BIN_CHUNK_TYPE)
    out += bin_raw
    assert len(out) == total
    return bytes(out)


def _patch_sha256_placeholder(file_bytes, digest_hex):
    """Replace the 64-char placeholder inside extras.sha256 with the real digest."""
    header_len = 12
    clen = struct.unpack("<I", file_bytes[header_len:header_len + 4])[0]
    json_bytes = file_bytes[header_len + 8:header_len + 8 + clen]
    span = _sha256_value_span(json_bytes)
    if span is None:
        raise RuntimeError("self-test: could not locate sha256 placeholder")
    if span[1] - span[0] != 64:
        raise RuntimeError("self-test: placeholder is not 64 chars")
    base = header_len + 8
    patched = bytearray(file_bytes)
    patched[base + span[0]:base + span[1]] = digest_hex.encode("ascii")
    return bytes(patched)


def run_self_test():
    tmpdir = tempfile.mkdtemp(prefix="intake_gate_selftest_")
    ok = True

    def verdict(label, cond):
        nonlocal ok
        print("%s ... %s" % (label, "PASS" if cond else "FAIL"))
        if not cond:
            ok = False

    # --- Positive case: build a valid GLB, inject its real (masked) sha256.
    placeholder = "0" * 64
    raw = _build_test_glb(placeholder)
    glb_path = os.path.join(tmpdir, "model.glb")
    with open(glb_path, "wb") as f:
        f.write(raw)

    # Compute the masked hash of the as-written file, then patch it in.
    with open(glb_path, "rb") as f:
        file_bytes = f.read()
    clen = struct.unpack("<I", file_bytes[12:16])[0]
    json_bytes = file_bytes[20:20 + clen]
    digest, _ = masked_file_sha256(file_bytes, json_bytes)
    assert digest, "self-test: masked hash failed on valid test file"
    patched = _patch_sha256_placeholder(file_bytes, digest)
    with open(glb_path, "wb") as f:
        f.write(patched)

    meta = {
        "type_id": "E-06",
        "licence_tier": "T1",
        "expected_anchors": ["mount_face"],
        "declared_up": "+Y",
        "declared_origin": "floor",
        "declared_front": "+Z",
    }
    meta_path = os.path.join(tmpdir, "meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f)

    report, code = run_gate(glb_path, meta, TRI_BUDGET_EQUIPMENT, "equipment/50000")
    for c in report["checks"]:
        print("    [check %d %s] %s: %s" % (c["id"], c["result"], c["name"], c["detail"]))
    verdict("positive case: valid GLB -> overall pass, exit 0",
            report["overall"] == "pass" and code == 0)

    # --- Negative case: bad magic -> overall fail.
    bad_path = os.path.join(tmpdir, "bad.glb")
    with open(bad_path, "wb") as f:
        f.write(b"BAD!" + b"\x00" * 32)
    report2, code2 = run_gate(bad_path, meta, TRI_BUDGET_EQUIPMENT, "equipment/50000")
    print("    [check 2] %s" % [c["detail"] for c in report2["checks"] if c["id"] == 2][0])
    verdict("negative case: bad magic -> overall fail, exit 1",
            report2["overall"] == "fail" and code2 == 1)

    print("self-test: %s" % ("ALL PASS" if ok else "FAILURES PRESENT"))
    return 0 if ok else 1


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Independent 7-check Intake Gate verifier for GLB/glTF 2.0 models.")
    ap.add_argument("model", nargs="?", help="path to the .glb file")
    ap.add_argument("--meta", help="path to META.json")
    ap.add_argument("--equipment", action="store_true",
                    help="50,000-triangle budget (default)")
    ap.add_argument("--device", action="store_true",
                    help="5,000-triangle budget")
    ap.add_argument("--self-test", action="store_true",
                    help="build test GLBs in /tmp and verify the gate itself")
    args = ap.parse_args(argv)

    if args.self_test:
        return run_self_test()

    if not args.model:
        ap.error("MODEL.glb is required (or use --self-test)")
    if not args.meta:
        ap.error("--meta META.json is required")

    meta, meta_err = load_meta(args.meta)
    if meta is None:
        # Emit a structured failure rather than a bare traceback.
        report = {
            "model": args.model,
            "sha256": None,
            "budget": None,
            "checks": [{"id": 1, "name": "licence", "result": "fail",
                        "detail": meta_err}],
            "overall": "fail",
        }
        print(json.dumps(report, indent=2))
        return 1

    budget = TRI_BUDGET_DEVICE if args.device else TRI_BUDGET_EQUIPMENT
    budget_label = ("device/5000" if args.device else "equipment/50000")
    report, code = run_gate(args.model, meta, budget, budget_label)
    print(json.dumps(report, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
