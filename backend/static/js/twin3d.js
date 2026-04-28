let scene;
let camera;
let renderer;
let controls;
let raycaster;
let mouse;
let roomMeshes = new Map();
let roomValues = {};
let centerCode;
let selectedRoomId = null;

function colorForValue(variable, value) {
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let n = 0;
  if (variable === 'temperature') n = clamp((value - 16) / 12);
  if (variable === 'co2') n = clamp((value - 500) / 1200);
  if (variable === 'relativeHumidity') n = clamp((value - 35) / 35);
  if (variable === 'LAeq') n = clamp((value - 40) / 35);
  if (variable === 'occupancy') n = clamp(value);

  const r = Math.round(20 + 210 * n);
  const g = Math.round(180 - 100 * n);
  const b = Math.round(120 - 90 * n);
  return new THREE.Color(`rgb(${r},${g},${b})`);
}

function centerCodeFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1];
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1417');

  camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1200);
  camera.position.set(18, 24, 30);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  const wrap = document.getElementById('twinCanvas');
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  wrap.innerHTML = '';
  wrap.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const amb = new THREE.AmbientLight(0xffffff, 0.7);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(12, 24, 8);
  scene.add(amb, dir);

  const grid = new THREE.GridHelper(140, 28, 0x44555b, 0x2b383d);
  scene.add(grid);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('click', onClickRoom);
  window.addEventListener('resize', onResize);
}

function onResize() {
  const wrap = document.getElementById('twinCanvas');
  if (!renderer || !camera || !wrap) return;
  camera.aspect = wrap.clientWidth / wrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
}

function makeRoomMesh(room) {
  const w = Math.max(4, Math.min(16, room.area / 65));
  const h = 2.8;
  const d = Math.max(4, Math.min(14, room.capacity / 70));
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color: '#3a8084', metalness: 0.1, roughness: 0.65 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(room.x, room.y + h / 2, room.z);
  mesh.userData = room;
  scene.add(mesh);

  const label = makeLabel(room.name);
  label.position.set(room.x, room.y + h + 1.4, room.z);
  scene.add(label);

  const sensor = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#f4b74d', emissive: '#b56914', emissiveIntensity: 0.35 })
  );
  sensor.position.set(room.x - w / 3, room.y + h + 0.6, room.z - d / 3);
  sensor.userData = { roomId: room.id, sensor: true };
  scene.add(sensor);

  roomMeshes.set(room.id, mesh);
}

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0f4ee';
  ctx.font = '24px Space Grotesk';
  ctx.fillText(text.slice(0, 34), 10, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 1, 1);
  return sprite;
}

function makeParticles() {
  const count = 200;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = 1 + Math.random() * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: '#6ed3ca', size: 0.17, transparent: true, opacity: 0.65 });
  const pts = new THREE.Points(geom, mat);
  pts.name = 'visitors-particles';
  scene.add(pts);
}

async function loadSceneData() {
  const data = await apiGet(`/api/centers/${centerCode}/3d-scene`);
  document.getElementById('sceneHint').textContent = data.shapeHint;
  data.rooms.forEach(makeRoomMesh);
  makeParticles();
}

async function refreshValues() {
  const rooms = await apiGet(`/api/centers/${centerCode}/rooms`);
  rooms.forEach((room) => {
    roomValues[room.id] = room.current || {};
  });
  paintRooms();
}

function activeVar() {
  return document.getElementById('variableSelect').value;
}

function paintRooms() {
  const variable = activeVar();
  roomMeshes.forEach((mesh, roomId) => {
    const row = roomValues[roomId] || {};
    let value = row.temperature;
    if (variable === 'co2') value = row.co2;
    if (variable === 'relativeHumidity') value = row.relativeHumidity;
    if (variable === 'LAeq') value = row.LAeq;
    if (variable === 'occupancy') value = row.occupancy;
    mesh.material.color = colorForValue(variable, Number(value || 0));
  });
}

function animate() {
  requestAnimationFrame(animate);

  const particles = scene.getObjectByName('visitors-particles');
  if (particles) {
    const pos = particles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i) + (Math.random() - 0.5) * 0.03;
      pos.setY(i, Math.max(0.5, Math.min(9.5, y)));
    }
    pos.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
}

async function openRoomPanel(roomId) {
  selectedRoomId = roomId;
  const [roomData, envData, arts] = await Promise.all([
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/environment/current`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/artworks`),
  ]);

  const panel = document.getElementById('roomPanel');
  panel.innerHTML = `
    <h3>${roomData.name}</h3>
    <div class="small">${roomData.description}</div>
    <div class="grid grid-2" style="margin-top:8px">
      <div>${tr('temperature')}: <strong>${formatMetric(envData.environment.temperature, { unit: '°C' })}</strong></div>
      <div>${tr('humidity')}: <strong>${formatMetric(envData.environment.relativeHumidity, { unit: '%' })}</strong></div>
      <div>${tr('co2')}: <strong>${formatMetric(envData.environment.co2, { digits: 0, unit: 'ppm' })}</strong></div>
      <div>${tr('occupancy')}: <strong>${formatMetric((envData.crowd.occupancy || 0) * 100, { digits: 0, unit: '%', zeroAsMissing: false })}</strong></div>
    </div>
    <h4 style="margin-top:10px">${tr('artworks')}</h4>
    <div class="small">${arts.slice(0, 8).map((a) => `${a.name} (${formatMetric(a.degradationRisk, { digits: 2, zeroAsMissing: false })})`).join('<br/>') || tr('noDataAvailable')}</div>
  `;
}

function onClickRoom(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Array.from(roomMeshes.values()));
  if (intersects.length) {
    const room = intersects[0].object.userData;
    openRoomPanel(room.id).catch((err) => console.error(err));
  }
}

async function runSpreadSimulation(originRoomId) {
  const data = await apiSend('/api/simulations/spread', 'POST', { room_id: originRoomId });
  data.frames.forEach((frame) => {
    setTimeout(() => {
      const mesh = roomMeshes.get(frame.roomId);
      if (!mesh) return;
      mesh.material.emissive = new THREE.Color('#37c89d');
      mesh.material.emissiveIntensity = frame.intensity;
      setTimeout(() => {
        mesh.material.emissiveIntensity = 0;
      }, 640);
    }, frame.delayMs);
  });
}

async function bootTwin() {
  centerCode = centerCodeFromPath();
  initScene();
  await loadSceneData();
  await refreshValues();
  animate();

  document.getElementById('variableSelect').addEventListener('change', paintRooms);
  document.getElementById('simulateSpread').addEventListener('click', () => {
    if (selectedRoomId) runSpreadSimulation(selectedRoomId);
  });

  setInterval(() => {
    refreshValues().catch((err) => console.error(err));
  }, 12000);

  const socket = ensureSocket();
  socket.on('update', () => refreshValues());
  socket.on('actuators', (msg) => {
    if (msg && msg.id && selectedRoomId && msg.id.includes(selectedRoomId.split(':').pop())) {
      runSpreadSimulation(selectedRoomId).catch((err) => console.error(err));
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'twin3d') return;
  bootTwin().catch((err) => console.error(err));
});
