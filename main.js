import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ============================================================
// Hero: a procedural 6-DOF robotic arm.
// Idle: slow cycle through a pick-place loop.
// On pointermove: end-effector chases the cursor via CCD IK.
// No external asset load — the arm is built from primitives.
// ============================================================
const canvas = document.getElementById("g1-canvas");
const loaderEl = document.getElementById("hero-loader");
const hintEl = document.getElementById("hero-hint");
const heroEl = document.querySelector(".hero");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = null;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// -------- camera --------
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
camera.position.set(2.6, 1.5, 2.8);

// -------- lights --------
const key = new THREE.DirectionalLight(0xffe9c7, 2.6);
key.position.set(2.5, 3.6, 2.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -2;
key.shadow.camera.right = 2;
key.shadow.camera.top = 2;
key.shadow.camera.bottom = -2;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 12;
key.shadow.bias = -0.0005;
scene.add(key);

const rim = new THREE.DirectionalLight(0x7ac6e6, 1.0);
rim.position.set(-3.0, 2.0, -2.5);
scene.add(rim);

const fill = new THREE.HemisphereLight(0xffffff, 0x0a0b0f, 0.35);
scene.add(fill);

// -------- ground --------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.ShadowMaterial({ opacity: 0.5 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(10, 40, 0x1d2030, 0x14161f);
grid.material.transparent = true;
grid.material.opacity = 0.55;
grid.position.y = 0.0005;
scene.add(grid);

// -------- controls --------
// Orbit only — no zoom, no pan. Keeps the arm visually proportional to
// the hero frame no matter what.
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.5, 0);
controls.enableZoom = false;
controls.enablePan = false;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;

let userHasInteracted = false;
const stopAutoRotate = () => {
  if (userHasInteracted) return;
  userHasInteracted = true;
  controls.autoRotate = false;
  if (hintEl) hintEl.style.opacity = "0.4";
};
canvas.addEventListener("pointerdown", stopAutoRotate, { once: true });

// ============================================================
// Build the arm.
//
// Convention: Y-up. The arm sits at the origin.
// Joint chain (shoulder → wrist):
//   J0  base yaw        (axis +Y)
//   J1  shoulder pitch  (axis +X)
//   J2  elbow pitch     (axis +X)
//   J3  forearm roll    (axis +Z)
//   J4  wrist pitch     (axis +X)
//   J5  wrist roll      (axis +Z)
// Each joint is a THREE.Group; each link is a mesh child of that group,
// then the next joint is a child positioned at the link's end.
// ============================================================

const BASE_H = 0.08;
const BASE_R = 0.18;
const L1 = 0.22;     // shoulder lift
const L2 = 0.55;     // upper arm
const L3 = 0.50;     // forearm
const L4 = 0.12;     // wrist offset
const L5 = 0.10;     // gripper length

const silver = new THREE.MeshStandardMaterial({
  color: 0xcfd3dd, metalness: 0.72, roughness: 0.3, envMapIntensity: 1.0,
});
const dark = new THREE.MeshStandardMaterial({
  color: 0x1b1f2a, metalness: 0.4, roughness: 0.55, envMapIntensity: 0.6,
});
const accent = new THREE.MeshStandardMaterial({
  color: 0xf4b85a, metalness: 0.5, roughness: 0.35, envMapIntensity: 0.9,
});

function cyl(r, h, m) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function cap(r, h, m) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 8, 24), m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function box(w, h, d, m) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Base plate.
const baseGroup = new THREE.Group();
scene.add(baseGroup);

const basePlate = cyl(BASE_R, BASE_H, dark);
basePlate.position.y = BASE_H / 2;
baseGroup.add(basePlate);

const baseCollar = cyl(BASE_R * 0.72, 0.04, silver);
baseCollar.position.y = BASE_H + 0.02;
baseGroup.add(baseCollar);

// J0: base yaw.
const j0 = new THREE.Group();
j0.position.y = BASE_H + 0.04;
baseGroup.add(j0);

// Shoulder housing (visual mass on J0).
const shoulderHousing = cyl(0.11, L1, silver);
shoulderHousing.position.y = L1 / 2;
j0.add(shoulderHousing);

// J1: shoulder pitch.
const j1 = new THREE.Group();
j1.position.y = L1;
j0.add(j1);

// Shoulder knuckle (dark cylinder perpendicular to pitch axis).
const shoulderKnuckle = cyl(0.08, 0.18, dark);
shoulderKnuckle.rotation.z = Math.PI / 2;
j1.add(shoulderKnuckle);

// Upper arm — capsule along +Y.
const upperArm = cap(0.065, L2 - 0.13, silver);
upperArm.position.y = L2 / 2;
j1.add(upperArm);

// Thin accent band on upper arm.
const upperBand = cyl(0.07, 0.03, accent);
upperBand.position.y = L2 - 0.12;
j1.add(upperBand);

// J2: elbow pitch, at the end of upper arm.
const j2 = new THREE.Group();
j2.position.y = L2;
j1.add(j2);

const elbowKnuckle = cyl(0.065, 0.14, dark);
elbowKnuckle.rotation.z = Math.PI / 2;
j2.add(elbowKnuckle);

const forearm = cap(0.055, L3 - 0.12, silver);
forearm.position.y = L3 / 2;
j2.add(forearm);

// J3: forearm roll.
const j3 = new THREE.Group();
j3.position.y = L3;
j2.add(j3);

const wristBase = cyl(0.055, 0.08, dark);
wristBase.position.y = 0.04;
j3.add(wristBase);

// J4: wrist pitch.
const j4 = new THREE.Group();
j4.position.y = 0.08;
j3.add(j4);

const wristKnuckle = cyl(0.05, 0.1, dark);
wristKnuckle.rotation.z = Math.PI / 2;
j4.add(wristKnuckle);

const wristSegment = cap(0.045, L4 - 0.06, silver);
wristSegment.position.y = L4 / 2;
j4.add(wristSegment);

// J5: wrist roll.
const j5 = new THREE.Group();
j5.position.y = L4;
j4.add(j5);

// Gripper housing.
const gripperHousing = cyl(0.055, 0.06, dark);
gripperHousing.position.y = 0.03;
j5.add(gripperHousing);

// Gripper fingers (two parallel plates).
const fingerW = 0.015, fingerH = L5, fingerD = 0.05, fingerGap = 0.055;
const fingerL = box(fingerW, fingerH, fingerD, silver);
fingerL.position.set(-fingerGap, 0.06 + fingerH / 2, 0);
j5.add(fingerL);
const fingerR = box(fingerW, fingerH, fingerD, silver);
fingerR.position.set(+fingerGap, 0.06 + fingerH / 2, 0);
j5.add(fingerR);

// End-effector tip (used as the IK target reference).
const tip = new THREE.Object3D();
tip.position.set(0, 0.06 + fingerH, 0);
j5.add(tip);

// The "cursor bead" — a small glowing amber sphere that the gripper grabs.
// In cursor mode it tracks the mouse; in idle it tracks the pick-place waypoint.
const bead = new THREE.Mesh(
  new THREE.SphereGeometry(0.028, 24, 24),
  new THREE.MeshStandardMaterial({
    color: 0xf4b85a,
    emissive: 0xf4b85a,
    emissiveIntensity: 0.65,
    metalness: 0.1,
    roughness: 0.35,
  })
);
bead.castShadow = true;
scene.add(bead);
const beadHalo = new THREE.Mesh(
  new THREE.SphereGeometry(0.055, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xf4b85a, transparent: true, opacity: 0.18 })
);
bead.add(beadHalo);
const beadPos = new THREE.Vector3();

// Joints with axes (joint-local frame) and angle limits (radians).
// Limits are tightened to prevent CCD IK from folding links through
// each other. Elbow is biased to flex in one direction only (like a
// human elbow) so the forearm can never pass through the upper arm.
const joints = [
  { group: j0, axis: new THREE.Vector3(0, 1, 0), limit: [-Math.PI, Math.PI] },
  { group: j1, axis: new THREE.Vector3(1, 0, 0), limit: [-1.15,    1.15]    },
  { group: j2, axis: new THREE.Vector3(1, 0, 0), limit: [ 0.15,    2.25]    },  // one-way elbow
  { group: j3, axis: new THREE.Vector3(0, 0, 1), limit: [-2.2,     2.2]     },
  { group: j4, axis: new THREE.Vector3(1, 0, 0), limit: [-1.3,     1.3]     },
  { group: j5, axis: new THREE.Vector3(0, 0, 1), limit: [-Math.PI, Math.PI] },
];

// Initial pose — vaguely "ready" (shoulder slightly forward, elbow bent).
j1.rotation.x = -0.6;
j2.rotation.x =  1.4;
j4.rotation.x =  0.4;

// ============================================================
// CCD inverse kinematics.
//
// For each joint from the end back to the base, rotate it so that the
// vector (joint → tip) aligns with (joint → target). Clamp to joint
// limits, blend the rotation for smoothness, and repeat a few passes.
// ============================================================
const _tipW = new THREE.Vector3();
const _jW = new THREE.Vector3();
const _toTip = new THREE.Vector3();
const _toTgt = new THREE.Vector3();
const _axisW = new THREE.Vector3();
const _deltaQ = new THREE.Quaternion();
const _invParentQ = new THREE.Quaternion();

function solveIK(target, { iterations = 6, blend = 0.35 } = {}) {
  for (let it = 0; it < iterations; it++) {
    for (let i = joints.length - 1; i >= 0; i--) {
      const { group, axis, limit } = joints[i];
      tip.updateWorldMatrix(true, false);
      tip.getWorldPosition(_tipW);
      group.updateWorldMatrix(true, false);
      group.getWorldPosition(_jW);

      _toTip.subVectors(_tipW, _jW).normalize();
      _toTgt.subVectors(target, _jW).normalize();

      // Project both onto the plane normal to the joint axis (world-space).
      _axisW.copy(axis).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion())).normalize();
      _toTip.addScaledVector(_axisW, -_toTip.dot(_axisW)).normalize();
      _toTgt.addScaledVector(_axisW, -_toTgt.dot(_axisW)).normalize();

      // Angle between the projected vectors, signed by the joint axis.
      let cosA = THREE.MathUtils.clamp(_toTip.dot(_toTgt), -1, 1);
      let angle = Math.acos(cosA);
      const cross = new THREE.Vector3().crossVectors(_toTip, _toTgt);
      if (cross.dot(_axisW) < 0) angle = -angle;
      angle *= blend;

      // Apply around the local axis.
      _deltaQ.setFromAxisAngle(axis, angle);
      group.quaternion.multiply(_deltaQ);

      // Clamp to joint limits by converting to axis-angle around the joint axis.
      // (Approximation: works because we only ever rotate about `axis`.)
      const current = currentAngleAroundAxis(group.quaternion, axis);
      const clamped = THREE.MathUtils.clamp(current, limit[0], limit[1]);
      if (clamped !== current) {
        group.quaternion.setFromAxisAngle(axis, clamped);
      }
    }
  }
}

function currentAngleAroundAxis(q, axis) {
  // Swing-twist decomposition: twist around `axis`.
  const dot = axis.x * q.x + axis.y * q.y + axis.z * q.z;
  const twist = new THREE.Quaternion(dot * axis.x, dot * axis.y, dot * axis.z, q.w).normalize();
  const sign = (twist.x * axis.x + twist.y * axis.y + twist.z * axis.z) < 0 ? -1 : 1;
  const w = THREE.MathUtils.clamp(twist.w, -1, 1);
  return 2 * Math.atan2(sign * Math.sqrt(1 - w * w), w);
}

// ============================================================
// Target: idle loop vs. cursor-follow.
// ============================================================
const target = new THREE.Vector3(0.7, 0.9, 0.2);
const targetSmooth = new THREE.Vector3().copy(target);

// Workspace guards: keep every target in a reachable annulus around the
// base so the arm stays extended and never crumples into its own base.
const WORKSPACE_MIN_R = 0.45;         // min distance from base axis (xz)
const WORKSPACE_MAX_R = L2 + L3 + L4 - 0.08;
const WORKSPACE_MIN_Y = 0.45;         // never dip below the shoulder housing

function clampWorkspace(v) {
  const r = Math.hypot(v.x, v.z) || 1e-6;
  if (r < WORKSPACE_MIN_R) {
    v.x *= WORKSPACE_MIN_R / r;
    v.z *= WORKSPACE_MIN_R / r;
  } else if (r > WORKSPACE_MAX_R) {
    v.x *= WORKSPACE_MAX_R / r;
    v.z *= WORKSPACE_MAX_R / r;
  }
  if (v.y < WORKSPACE_MIN_Y) v.y = WORKSPACE_MIN_Y;
  return v;
}

const idleWaypoints = [
  new THREE.Vector3( 0.85, 1.05, -0.30),  // approach right
  new THREE.Vector3( 0.85, 0.55, -0.30),  // down to pick
  new THREE.Vector3( 0.85, 1.10, -0.30),  // lift
  new THREE.Vector3( 0.20, 1.10,  0.85),  // swing to front-left
  new THREE.Vector3( 0.20, 0.55,  0.85),  // down to place
  new THREE.Vector3( 0.20, 1.10,  0.85),  // lift
  new THREE.Vector3( 0.70, 1.15,  0.45),  // intermediate
].map(clampWorkspace);
let idlePhase = 0;        // 0..1 within current segment
let idleIndex = 0;        // current waypoint index
const idleSpeed = 0.33;   // segments per second

// Cursor-reactive mode: when the pointer is inside the hero, follow it.
let cursorMode = false;
let cursorTarget = new THREE.Vector3();
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
// Workspace plane: a horizontal plane at y=0.8 is where the arm comfortably reaches.
const workspacePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.75);
const workspacePoint = new THREE.Vector3();

function pointerToWorkspace(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(workspacePlane, workspacePoint)) {
    workspacePoint.y = 0.9;
    return clampWorkspace(workspacePoint);
  }
  return null;
}

heroEl.addEventListener("pointermove", (e) => {
  const p = pointerToWorkspace(e.clientX, e.clientY);
  if (p) { cursorTarget.copy(p); cursorMode = true; }
});
heroEl.addEventListener("pointerleave", () => { cursorMode = false; });

// Hide the loader — nothing to load.
setTimeout(() => loaderEl?.classList.add("hidden"), 150);

// Scroll progress bar: fills the hairline across the top as the page scrolls.
const scrollBar = document.getElementById("scroll-bar");
if (scrollBar) {
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? (window.scrollY / h) * 100 : 0;
    scrollBar.style.width = p.toFixed(2) + "%";
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

// ============================================================
// Loop.
// ============================================================
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

const clock = new THREE.Clock();

// Gripper state: 0 = open, 1 = closed around the bead.
let gripState = 0;
const FINGER_OPEN = 0.055;
const FINGER_CLOSED = 0.018;  // just wide enough to flank the bead
const GRAB_RADIUS = 0.09;     // tip within this distance → close grip

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  resize();

  if (cursorMode) {
    target.copy(cursorTarget);
  } else {
    idlePhase += dt * idleSpeed;
    if (idlePhase >= 1) {
      idlePhase -= 1;
      idleIndex = (idleIndex + 1) % idleWaypoints.length;
    }
    const a = idleWaypoints[idleIndex];
    const b = idleWaypoints[(idleIndex + 1) % idleWaypoints.length];
    const t = idlePhase * idlePhase * (3 - 2 * idlePhase);
    target.lerpVectors(a, b, t);
  }

  // Smooth the IK target so the arm has an inertial feel.
  targetSmooth.lerp(target, 0.12);

  // The bead sits exactly at the IK target in idle mode so the arm
  // appears to carry it. In cursor mode it snaps to the raw cursor so
  // the user sees their intent, and the arm chases.
  if (cursorMode) {
    bead.position.lerp(cursorTarget, 0.5);
  } else {
    bead.position.copy(targetSmooth);
  }

  solveIK(targetSmooth, { iterations: 5, blend: 0.42 });

  // Close the gripper when the tip is near the bead.
  tip.updateWorldMatrix(true, false);
  tip.getWorldPosition(_tipW);
  const d = _tipW.distanceTo(bead.position);
  const want = d < GRAB_RADIUS ? 1 : 0;
  gripState += (want - gripState) * 0.18;
  const g = THREE.MathUtils.lerp(FINGER_OPEN, FINGER_CLOSED, gripState);
  fingerL.position.x = -g;
  fingerR.position.x = +g;

  // Gentle bead pulse.
  const s = 1 + Math.sin(clock.elapsedTime * 2.6) * 0.06;
  beadHalo.scale.setScalar(s);

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
