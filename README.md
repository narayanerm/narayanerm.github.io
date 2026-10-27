# portfolio-site

Personal portfolio for Narayane Ribeiro Medeiros — Humanoid Loco-Manipulation on the Unitree G1.

Static site. No build step. Hero is a Three.js scene with a GLB of the G1
robot (interactive orbit / zoom), rebuilt from the project's MJCF.

## Run

```bash
python3 -m http.server 8765
# open http://localhost:8765
```

A real server is required (file://) will fail because of ES-module and GLB
fetches.

## Layout

```
index.html          Markup
styles.css          Design tokens + layout
main.js             Three.js hero (loads assets/g1.glb)
assets/
  g1.glb              Full G1 in rest pose, 35 meshes, one node per body
  g1_kinematics.json  29 joints (name, axis, range, local pose) for future animation
  gifs/*.gif          Per-stage demos copied from the project repos
scripts/
  build_g1_glb.py     Parses ../itandroids-academic/.../g1.xml and merges STLs
```

## Rebuild the GLB

Only needed if the MJCF or meshes change.

```bash
python3 scripts/build_g1_glb.py
```

Requires `trimesh` (and its STL / glTF deps). Pulls meshes from
`~/itandroids/itandroids-academic/draft/cenarios/shared/g1/`.

## Content sources

Project cards point at the GitHub repos under
[github.com/narayanerm](https://github.com/narayanerm). The GIFs in
`assets/gifs/` were lifted from `future_lab/futurelab_v4/` and each repo's
`docs/`. Replace them in place to update the site.

## Possible next steps

- Animate the robot: `g1_kinematics.json` already has the joint tree; the
  per-body nodes in the GLB are kept named (`left_hip_pitch_link`, etc.) so JS
  can rotate them around their axes to replay joint trajectories exported from
  the trained policies.
- Decimate the GLB (currently ~7.7 MiB) — the visual STLs are high-poly;
  `trimesh.Trimesh.simplify_quadric_decimation(target_count)` cuts it hard.
- Add a `/<project>` page per repo for a case-study treatment.
