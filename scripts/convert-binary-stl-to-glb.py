"""Convert an inspected binary STL from millimeters to a compact meter-space GLB.

Usage: python scripts/convert-binary-stl-to-glb.py source.stl output.glb
STL is untextured and has no material; the output uses a neutral material.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np


def convert(source: Path, target: Path):
    raw = source.read_bytes()
    if len(raw) < 84:
        raise ValueError('STL header is incomplete')
    faces = struct.unpack_from('<I', raw, 80)[0]
    if not faces or len(raw) != 84 + 50 * faces:
        raise ValueError('Binary STL size does not match triangle count')
    record = np.dtype([('normal', '<f4', 3), ('vertices', '<f4', (3, 3)), ('attribute', '<u2')])
    triangles = np.frombuffer(raw, dtype=record, offset=84, count=faces)
    points = triangles['vertices'].reshape(-1, 3).astype('<f4')
    if not np.isfinite(points).all():
        raise ValueError('STL has nonfinite coordinates')
    bounds_mm = np.ptp(points, axis=0)
    if np.any(bounds_mm <= 0) or np.max(bounds_mm) > 10000:
        raise ValueError('STL bounds require manual unit/scale review')
    points = ((points - (points.min(axis=0) + points.max(axis=0)) / 2) * .001).astype('<f4')
    normals = np.repeat(triangles['normal'], 3, axis=0).astype('<f4')
    lengths = np.linalg.norm(normals, axis=1)
    normals[lengths > 0] /= lengths[lengths > 0, None]
    geometry = points.tobytes() + normals.tobytes()
    count = len(points)
    document = {
        'asset': {'version': '2.0', 'generator': 'STRATUM inspected binary STL conversion'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1}, 'material': 0}]}],
        'materials': [{'pbrMetallicRoughness': {'baseColorFactor': [.23, .48, .53, 1], 'metallicFactor': 0, 'roughnessFactor': .72}, 'doubleSided': True}],
        'buffers': [{'byteLength': len(geometry)}],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': count * 12, 'target': 34962}, {'buffer': 0, 'byteOffset': count * 12, 'byteLength': count * 12, 'target': 34962}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': count, 'type': 'VEC3', 'min': points.min(axis=0).tolist(), 'max': points.max(axis=0).tolist()},
            {'bufferView': 1, 'componentType': 5126, 'count': count, 'type': 'VEC3'},
        ],
    }
    json_bytes = json.dumps(document, separators=(',', ':')).encode()
    json_chunk = json_bytes + b' ' * (-len(json_bytes) % 4)
    bin_chunk = geometry + b'\0' * (-len(geometry) % 4)
    length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(struct.pack('<4sII', b'glTF', 2, length) + struct.pack('<I4s', len(json_chunk), b'JSON') + json_chunk + struct.pack('<I4s', len(bin_chunk), b'BIN\0') + bin_chunk)
    print(json.dumps({'sourceSha256': hashlib.sha256(raw).hexdigest(), 'glbSha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'faces': faces, 'boundsMeters': (bounds_mm * .001).tolist(), 'glbBytes': length}))


if __name__ == '__main__':
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
