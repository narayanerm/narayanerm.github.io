"""Parse the G1 MJCF, apply rest-pose transforms, and emit a single GLB.

The scene graph keeps the body hierarchy so joint animation can be layered on
later from the JS side (each joint-bearing body is its own node with the joint
origin in local space).

Inputs
------
MJCF:   /home/narayane/itandroids/itandroids-academic/draft/cenarios/shared/g1/g1.xml
STLs:   same directory, under assets/

Output
------
portfolio-site/assets/g1.glb
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import trimesh
import trimesh.transformations as tft

MJCF_PATH = Path("/home/narayane/itandroids/itandroids-academic/draft/cenarios/shared/g1/g1.xml")
MESH_DIR = MJCF_PATH.parent / "assets"
OUT_GLB = Path("/home/narayane/itandroids/portfolio-site/assets/g1.glb")
OUT_META = Path("/home/narayane/itandroids/portfolio-site/assets/g1_kinematics.json")

# MJCF material -> RGBA
MATERIALS = {
    "silver": (0.78, 0.80, 0.82, 1.0),
    "black":  (0.12, 0.12, 0.13, 1.0),
}
DEFAULT_MATERIAL = "silver"


def parse_vec(s: str | None, n: int, default):
    if s is None:
        return np.array(default, dtype=float)
    v = [float(x) for x in s.split()]
    assert len(v) == n, f"expected {n} floats, got {s!r}"
    return np.array(v, dtype=float)


def mjcf_quat_to_mat(wxyz: np.ndarray) -> np.ndarray:
    w, x, y, z = wxyz
    # tft.quaternion_matrix takes [w, x, y, z]
    return tft.quaternion_matrix([w, x, y, z])


def pose_matrix(pos: np.ndarray, quat_wxyz: np.ndarray) -> np.ndarray:
    T = mjcf_quat_to_mat(quat_wxyz)
    T[:3, 3] = pos
    return T


def load_meshes(asset_root: ET.Element) -> dict[str, Path]:
    meshes: dict[str, Path] = {}
    for m in asset_root.findall("mesh"):
        name = m.get("name")
        file = m.get("file")
        assert name and file
        p = MESH_DIR / file
        if not p.exists():
            raise FileNotFoundError(p)
        meshes[name] = p
    return meshes


def build_scene(root: ET.Element) -> tuple[trimesh.Scene, list[dict]]:
    asset = root.find("asset")
    assert asset is not None
    mesh_files = load_meshes(asset)

    worldbody = root.find("worldbody")
    assert worldbody is not None
    scene = trimesh.Scene(base_frame="world")
    kinematics: list[dict] = []

    def walk(body_elem: ET.Element, parent_frame: str, depth: int = 0):
        body_name = body_elem.get("name") or f"body_{id(body_elem)}"
        pos = parse_vec(body_elem.get("pos"), 3, [0, 0, 0])
        quat = parse_vec(body_elem.get("quat"), 4, [1, 0, 0, 0])
        T_body = pose_matrix(pos, quat)

        # Joint info (for the kinematics manifest; only one joint per non-root body here)
        joint_elem = body_elem.find("joint")
        if joint_elem is not None:
            kinematics.append({
                "body": body_name,
                "parent": parent_frame,
                "joint_name": joint_elem.get("name"),
                "axis": [float(x) for x in (joint_elem.get("axis") or "0 0 1").split()],
                "range": [float(x) for x in (joint_elem.get("range") or "0 0").split()],
                "local_pos": pos.tolist(),
                "local_quat_wxyz": quat.tolist(),
            })

        frame_name = body_name
        # Register this body's frame under the parent at its local transform.
        # trimesh.Scene.graph.update expects transform in parent frame.
        scene.graph.update(frame_from=parent_frame, frame_to=frame_name, matrix=T_body)

        # Attach each mesh geom in this body.
        for geom in body_elem.findall("geom"):
            if geom.get("type") not in (None, "mesh"):  # only visual mesh geoms
                continue
            mesh_name = geom.get("mesh")
            if not mesh_name or mesh_name not in mesh_files:
                continue
            # geom-local transform within the body
            g_pos = parse_vec(geom.get("pos"), 3, [0, 0, 0])
            g_quat = parse_vec(geom.get("quat"), 4, [1, 0, 0, 0])
            T_geom_local = pose_matrix(g_pos, g_quat)

            mat_name = geom.get("material") or DEFAULT_MATERIAL
            rgba = MATERIALS.get(mat_name, MATERIALS[DEFAULT_MATERIAL])

            mesh = trimesh.load_mesh(mesh_files[mesh_name], force="mesh")
            # Color the mesh.
            mesh.visual = trimesh.visual.ColorVisuals(
                mesh=mesh,
                face_colors=np.tile((np.array(rgba) * 255).astype(np.uint8), (len(mesh.faces), 1)),
            )

            geom_frame = f"{body_name}__{mesh_name}"
            scene.add_geometry(
                geometry=mesh,
                node_name=geom_frame,
                parent_node_name=frame_name,
                transform=T_geom_local,
                geom_name=mesh_name,
            )

        for child in body_elem.findall("body"):
            walk(child, parent_frame=frame_name, depth=depth + 1)

    for body in worldbody.findall("body"):
        walk(body, parent_frame="world")

    return scene, kinematics


def main() -> None:
    root = ET.parse(MJCF_PATH).getroot()
    scene, kinematics = build_scene(root)

    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    glb_bytes = scene.export(file_type="glb")
    OUT_GLB.write_bytes(glb_bytes)
    OUT_META.write_text(json.dumps({"joints": kinematics}, indent=2))

    print(f"wrote {OUT_GLB} ({OUT_GLB.stat().st_size / 1024:.1f} KiB)")
    print(f"wrote {OUT_META} ({len(kinematics)} joints)")


if __name__ == "__main__":
    main()
