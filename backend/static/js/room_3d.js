import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── State ────────────────────────────────────────────────────────────────────
let scene, camera, renderer, controls, raycaster;
const mouse = new THREE.Vector2();
const artworkObjects = []; // { mesh, artwork }
const sensorObjects  = []; // { mesh, device  }
let currentRoomId;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
let canvas, tooltip, panel, panelContent, roomInfoBar;

// ─── Room dimensions ──────────────────────────────────────────────────────────
const ROOM_W = 12, ROOM_H = 3.5, ROOM_D = 8;

// ─── Sensor state → hex colour ────────────────────────────────────────────────
const SENSOR_HEX = { on: 0x2ecc71, off: 0xe74c3c, fault: 0xe67e22, maintenance: 0xe67e22 };
function sensorHex(state) { return SENSOR_HEX[(state || '').toLowerCase()] ?? SENSOR_HEX.off; }
function sensorCss(state) {
  const hex = sensorHex(state);
  return '#' + hex.toString(16).padStart(6, '0');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function roomIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[1]);
}

function loadTexture(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(url, resolve, undefined, () => resolve(null));
  });
}

// ─── Artwork wall slots (11 slots across back, right, left walls) ──────────────
function wallSlots() {
  const hw = ROOM_W / 2, hd = ROOM_D / 2;
  return [
    // Back wall – 5 positions along X
    { pos: [-4,   1.72, -(hd - 0.03)], rot: [0, 0,               0] },
    { pos: [-2,   1.72, -(hd - 0.03)], rot: [0, 0,               0] },
    { pos: [0,    1.72, -(hd - 0.03)], rot: [0, 0,               0] },
    { pos: [2,    1.72, -(hd - 0.03)], rot: [0, 0,               0] },
    { pos: [4,    1.72, -(hd - 0.03)], rot: [0, 0,               0] },
    // Right wall – 3 positions along Z
    { pos: [(hw - 0.03), 1.72, -2], rot: [0, -Math.PI / 2, 0] },
    { pos: [(hw - 0.03), 1.72,  0], rot: [0, -Math.PI / 2, 0] },
    { pos: [(hw - 0.03), 1.72,  2], rot: [0, -Math.PI / 2, 0] },
    // Left wall – 3 positions along Z
    { pos: [-(hw - 0.03), 1.72, -2], rot: [0,  Math.PI / 2, 0] },
    { pos: [-(hw - 0.03), 1.72,  0], rot: [0,  Math.PI / 2, 0] },
    { pos: [-(hw - 0.03), 1.72,  2], rot: [0,  Math.PI / 2, 0] },
  ];
}

// ─── Sensor ceiling slots ──────────────────────────────────────────────────────
function sensorSlots(count) {
  const base = [
    [-3, -2], [0, -2], [3, -2],
    [-3,  0], [0,  0], [3,  0],
    [-3,  2], [0,  2], [3,  2],
    [-4, -3], [4, -3],
  ];
  return base.slice(0, count).map(([x, z]) => [x, ROOM_H - 0.12, z]);
}

// ─── Scene initialisation ─────────────────────────────────────────────────────
function initScene() {
  canvas     = document.getElementById('scene-canvas');
  tooltip    = document.getElementById('scene-tooltip');
  panel      = document.getElementById('scene-panel');
  panelContent = document.getElementById('panel-content');
  roomInfoBar  = document.getElementById('room-info-bar');

  const wrap = document.getElementById('sceneWrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 16, 35);

  camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
  camera.position.set(0, 2.6, 7.8);
  camera.lookAt(0, 1.5, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.84;
  controls.minDistance = 1.5;
  controls.maxDistance = 15;
  controls.update();

  raycaster = new THREE.Raycaster();

  buildLights();
  buildRoom();
  wireEvents();
  animate();
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
function buildLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));

  const main = new THREE.PointLight(0xfff8e7, 2.2, 16);
  main.position.set(0, ROOM_H - 0.3, 0);
  main.castShadow = true;
  main.shadow.mapSize.set(512, 512);
  scene.add(main);

  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(6, 5, 4);
  scene.add(fill);
}

// ─── Room geometry ────────────────────────────────────────────────────────────
function buildRoom() {
  const hw = ROOM_W / 2, hd = ROOM_D / 2;
  const wallCol = 0xf5f0e8;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshLambertMaterial({ color: 0x7a5c38 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshLambertMaterial({ color: 0xe8e4dc })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_H;
  scene.add(ceiling);

  // Walls (PlaneGeometry facing inward)
  const wm = new THREE.MeshLambertMaterial({ color: wallCol });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wm);
  backWall.position.set(0, ROOM_H / 2, -hd);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wm);
  frontWall.position.set(0, ROOM_H / 2, hd);
  frontWall.rotation.y = Math.PI;
  scene.add(frontWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wm);
  leftWall.position.set(-hw, ROOM_H / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wm);
  rightWall.position.set(hw, ROOM_H / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // Baseboard accent
  const bbMat = new THREE.MeshLambertMaterial({ color: 0x5a4020 });
  [[-hd, 0], [hd, Math.PI]].forEach(([z, ry]) => {
    const bb = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.1, 0.05), bbMat);
    bb.position.set(0, 0.05, z + (ry === 0 ? 0.025 : -0.025));
    bb.rotation.y = ry;
    scene.add(bb);
  });
  [-hw, hw].forEach((x, i) => {
    const bb = new THREE.Mesh(new THREE.BoxGeometry(ROOM_D, 0.1, 0.05), bbMat);
    bb.position.set(x + (i === 0 ? 0.025 : -0.025), 0.05, 0);
    bb.rotation.y = i === 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(bb);
  });
}

// ─── Artwork frames ───────────────────────────────────────────────────────────
async function loadArtworks(roomId) {
  let arts;
  try { arts = await apiGet(`/api/rooms/${encodeURIComponent(roomId)}/artworks`); }
  catch { return; }
  if (!arts.length) return;

  const slots = wallSlots();
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2c1a0e });
  const AW = 1.42, AH = 1.02, AD = 0.07;

  for (let i = 0; i < Math.min(arts.length, slots.length); i++) {
    const art  = arts[i];
    const slot = slots[i];

    const tex = await loadTexture(art.image);
    const frontMat = tex
      ? new THREE.MeshBasicMaterial({ map: tex })
      : new THREE.MeshLambertMaterial({ color: 0x5a4535 + (i * 0x080808 & 0x3f3f3f) });

    // BoxGeometry face indices: 0=+X 1=-X 2=+Y 3=-Y 4=+Z(front) 5=-Z(back)
    const materials = [frameMat, frameMat, frameMat, frameMat, frontMat, frameMat];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(AW, AH, AD), materials);
    mesh.position.set(...slot.pos);
    mesh.rotation.set(...slot.rot);
    mesh.castShadow = true;
    scene.add(mesh);
    artworkObjects.push({ mesh, artwork: art });

    // Spot light aimed at the artwork
    const [px, py, pz] = slot.pos;
    const ry = slot.rot[1];
    const offX = ry === 0 ? 0 : (ry > 0 ? -0.6 : 0.6);
    const offZ = ry === 0 ? 0.7 : 0;
    const spot = new THREE.PointLight(0xfff3c0, 0.7, 3.2);
    spot.position.set(px + offX, py + 1.1, pz + offZ);
    scene.add(spot);
  }
}

// ─── Sensors ──────────────────────────────────────────────────────────────────
async function loadDevices(roomId) {
  let devices;
  try { devices = await apiGet(`/api/rooms/${encodeURIComponent(roomId)}/devices`); }
  catch { return; }
  if (!devices.length) return;

  const slots = sensorSlots(devices.length);

  devices.forEach((device, i) => {
    const slot = slots[i] ?? [0, ROOM_H - 0.12, 0];
    const col  = sensorHex(device.deviceState);

    const mat = new THREE.MeshLambertMaterial({
      color: col,
      emissive: device.deviceState === 'on' ? new THREE.Color(0x2ecc71) : new THREE.Color(0),
      emissiveIntensity: device.deviceState === 'on' ? 0.4 : 0,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 10), mat);
    mesh.position.set(...slot);
    mesh.castShadow = true;
    scene.add(mesh);

    // Thin wire to ceiling
    const wirePts = [
      new THREE.Vector3(slot[0], ROOM_H, slot[2]),
      new THREE.Vector3(slot[0], slot[1] + 0.09, slot[2]),
    ];
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(wirePts),
      new THREE.LineBasicMaterial({ color: 0x888888 })
    ));

    sensorObjects.push({ mesh, device });
  });
}

// ─── Side panel ───────────────────────────────────────────────────────────────
function showArtworkPanel(art) {
  const risk    = Number(art.degradationRisk || 0);
  const riskPct = (risk * 100).toFixed(1);
  const rColor  = risk > 0.7 ? '#e74c3c' : risk > 0.4 ? '#f39c12' : '#2ecc71';
  panelContent.innerHTML = `
    <h3>${escapeHtml(art.name || 'Obra')}</h3>
    ${art.image ? `<img src="${escapeHtml(art.image)}" alt="${escapeHtml(art.name || '')}" loading="lazy">` : ''}
    ${art.artist      ? `<p><i class="fas fa-user fa-xs" style="color:#888;margin-right:6px"></i>${escapeHtml(art.artist)}</p>` : ''}
    ${art.year || art.dateCreated
      ? `<p><i class="fas fa-calendar fa-xs" style="color:#888;margin-right:6px"></i>${escapeHtml(String(art.year || art.dateCreated))}</p>` : ''}
    ${art.material    ? `<p><i class="fas fa-cube fa-xs" style="color:#888;margin-right:6px"></i>${escapeHtml(art.material)}</p>` : ''}
    ${art.technique   ? `<p><i class="fas fa-palette fa-xs" style="color:#888;margin-right:6px"></i>${escapeHtml(art.technique)}</p>` : ''}
    <div style="margin-top:12px">
      <p style="margin-bottom:4px"><i class="fas fa-triangle-exclamation fa-xs" style="color:${rColor};margin-right:6px"></i>Riesgo de degradación</p>
      <div class="risk-bar-track"><div class="risk-bar-fill" style="width:${riskPct}%;background:${rColor}"></div></div>
      <span style="font-size:0.78rem;color:${rColor}">${riskPct}%</span>
    </div>
  `;
  panel.style.display = 'block';
}

function showSensorPanel(dev) {
  const state   = dev.deviceState || 'unknown';
  const cssCol  = sensorCss(state);
  const batPct  = dev.batteryLevel !== undefined ? `${Math.round(Number(dev.batteryLevel) * 100)}%` : '—';
  panelContent.innerHTML = `
    <h3>${escapeHtml(dev.name || dev.id)}</h3>
    <p><i class="fas fa-microchip fa-xs" style="color:#888;margin-right:6px"></i>${escapeHtml(dev.deviceCategory || dev.category || '—')}</p>
    <p>Estado: <span class="sensor-badge" style="background:${cssCol}">${escapeHtml(state)}</span></p>
    <p><i class="fas fa-battery-three-quarters fa-xs" style="color:#888;margin-right:6px"></i>Batería: ${batPct}</p>
    ${dev.lastReading
      ? `<p><i class="fas fa-clock fa-xs" style="color:#888;margin-right:6px"></i>${escapeHtml(dev.lastReading)}</p>` : ''}
  `;
  panel.style.display = 'block';
}

function hidePanel() { panel.style.display = 'none'; }

// ─── Events & raycasting ──────────────────────────────────────────────────────
function allPickableMeshes() {
  return [...artworkObjects.map(o => o.mesh), ...sensorObjects.map(o => o.mesh)];
}

function wireEvents() {
  const cvs = renderer.domElement;

  cvs.addEventListener('mousemove', e => {
    const rect = cvs.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    mouse.x =  (x / rect.width)  * 2 - 1;
    mouse.y = -(y / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(allPickableMeshes());

    if (hits.length) {
      const obj = hits[0].object;
      const ao  = artworkObjects.find(o => o.mesh === obj);
      const so  = sensorObjects.find(o => o.mesh === obj);
      let lines = [];
      if (ao) {
        lines = [
          ao.artwork.name  || 'Obra',
          ao.artwork.artist || '',
          ao.artwork.year   ? String(ao.artwork.year) : '',
        ].filter(Boolean);
      } else if (so) {
        lines = [
          so.device.name || so.device.id,
          so.device.deviceCategory || '',
          `Estado: ${so.device.deviceState || '—'}`,
        ].filter(Boolean);
      }
      tooltip.innerHTML = lines
        .map((l, i) => i === 0 ? `<strong>${escapeHtml(l)}</strong>` : escapeHtml(l))
        .join('<br>');
      tooltip.style.left = `${x + 14}px`;
      tooltip.style.top  = `${y - 8}px`;
      tooltip.style.display = 'block';
      cvs.style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      cvs.style.cursor = '';
    }
  });

  cvs.addEventListener('click', () => {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(allPickableMeshes());
    if (hits.length) {
      const obj = hits[0].object;
      const ao  = artworkObjects.find(o => o.mesh === obj);
      const so  = sensorObjects.find(o => o.mesh === obj);
      if (ao)     showArtworkPanel(ao.artwork);
      else if (so) showSensorPanel(so.device);
    } else {
      hidePanel();
    }
  });

  document.getElementById('panel-close').addEventListener('click', hidePanel);

  window.addEventListener('resize', () => {
    const wrap = document.getElementById('sceneWrap');
    const W = wrap.clientWidth, H = wrap.clientHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  });
}

// ─── Sensor colour refresh (every 30s) ───────────────────────────────────────
async function refreshSensorColors() {
  try {
    const devices = await apiGet(`/api/rooms/${encodeURIComponent(currentRoomId)}/devices`);
    const byId = Object.fromEntries(devices.map(d => [d.id, d]));
    sensorObjects.forEach(({ mesh, device }) => {
      const upd = byId[device.id];
      if (!upd) return;
      const col = sensorHex(upd.deviceState);
      mesh.material.color.setHex(col);
      if (upd.deviceState === 'on') {
        mesh.material.emissive.setHex(0x2ecc71);
        mesh.material.emissiveIntensity = 0.4;
      } else {
        mesh.material.emissiveIntensity = 0;
      }
      device.deviceState = upd.deviceState;
    });
  } catch { /* silent */ }
}

// ─── Animation loop ───────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  currentRoomId = roomIdFromPath();
  initScene();

  const backBtn = document.getElementById('backToRoom');
  if (backBtn) backBtn.href = `/room/${encodeURIComponent(currentRoomId)}`;

  let roomData;
  try { roomData = await apiGet(`/api/rooms/${encodeURIComponent(currentRoomId)}`); }
  catch { roomData = {}; }

  document.title = `AuraVault 3D — ${roomData.name || 'Sala'}`;
  if (roomInfoBar) {
    roomInfoBar.textContent = `${roomData.name || 'Sala'} · 3D · Clic en obra o sensor para más info`;
  }

  await Promise.all([
    loadArtworks(currentRoomId),
    loadDevices(currentRoomId),
  ]);

  setInterval(refreshSensorColors, 30_000);
}

document.addEventListener('DOMContentLoaded', () => boot().catch(console.error));
