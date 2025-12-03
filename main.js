import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera setup
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 15, 15);
camera.lookAt(0, 0, 0);

// Renderer setup with shadow mapping
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Environment map for subtle glossy PBR look
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

// Nicer background: radial gradient CanvasTexture (no renderer alpha changes)
function createGradientBackground() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(
        size * 0.5, size * 0.35, size * 0.2,
        size * 0.5, size * 0.5, size * 0.7
    );
    grad.addColorStop(0, '#222640');
    grad.addColorStop(1, '#0f1222');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

scene.background = createGradientBackground();

// Textures (load asynchronously and only apply on success)
const textureLoader = new THREE.TextureLoader();
let woodTex = null;
try {
    textureLoader.load('885.jpg', (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.colorSpace = THREE.SRGBColorSpace;
        woodTex = tex;
        if (platform) {
            platform.material.map = tex;
            platform.material.needsUpdate = true;
        }
    }, undefined, () => {
        woodTex = null; // keep solid color fallback
    });
} catch (e) { woodTex = null; }

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enabled = false; // Start with controls disabled
controls.minDistance = 5;
controls.maxDistance = 30;

// Clock for physics
const clock = new THREE.Clock();

// Lighting setup
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -15;
directionalLight.shadow.camera.right = 15;
directionalLight.shadow.camera.top = 15;
directionalLight.shadow.camera.bottom = -15;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.bias = -0.0005;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffffff, 0.5, 50);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);


// Platform group (will be rotated for tilt)
const platformGroup = new THREE.Group();
scene.add(platformGroup);

// Platform
const platformSize = 10;
const platformGeometry = new THREE.BoxGeometry(platformSize, 0.5, platformSize);
const platformMaterial = new THREE.MeshPhongMaterial({
    color: 0x8d5524,
    shininess: 35
});
const platform = new THREE.Mesh(platformGeometry, platformMaterial);
platform.position.y = -0.25;
platform.receiveShadow = true;
platformGroup.add(platform);
// If texture was already loaded before mesh creation, apply it now
if (woodTex) {
    platform.material.map = woodTex;
    platform.material.needsUpdate = true;
}

// Platform border with color coding
const borderHeight = 0.5;
const borderThickness = 0.3;

// Create borders with unique color for each side
// North (Up arrow) = Red, South (Down arrow) = Orange
// West (Left arrow) = Teal, East (Right arrow) = Dark Blue
const borders = [
    // North (Red - controlled by Up arrow)
    { pos: [0, borderHeight/2, -platformSize/2], size: [platformSize + borderThickness*2, borderHeight, borderThickness], color: 0xff0000 },
    // South (Orange - controlled by Down arrow)
    { pos: [0, borderHeight/2, platformSize/2], size: [platformSize + borderThickness*2, borderHeight, borderThickness], color: 0xff8800 },
    // East (Dark Blue - controlled by Right arrow)
    { pos: [platformSize/2, borderHeight/2, 0], size: [borderThickness, borderHeight, platformSize], color: 0x0000aa },
    // West (Teal - controlled by Left arrow)
    { pos: [-platformSize/2, borderHeight/2, 0], size: [borderThickness, borderHeight, platformSize], color: 0x00aaaa }
];

borders.forEach(border => {
    const geometry = new THREE.BoxGeometry(...border.size);
    const material = new THREE.MeshPhongMaterial({
        color: border.color,
        shininess: 80,
        specular: 0xffffff
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...border.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    platformGroup.add(mesh);
});

// Add Z-axis orientation vector (thin arrow pointing up)
const arrowLength = 2.0;
const arrowHeadLength = 0.4;
const arrowHeadWidth = 0.2;
const arrowShaftRadius = 0.05;

// Create arrow shaft (cylinder)
const shaftGeometry = new THREE.CylinderGeometry(arrowShaftRadius, arrowShaftRadius, arrowLength - arrowHeadLength, 8);
const shaftMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.3 });
const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
shaft.position.y = (arrowLength - arrowHeadLength) / 2;

// Create arrow head (cone)
const headGeometry = new THREE.ConeGeometry(arrowHeadWidth, arrowHeadLength, 8);
const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.3 });
const head = new THREE.Mesh(headGeometry, headMaterial);
head.position.y = arrowLength - arrowHeadLength / 2;

// Group the arrow parts
const zAxisArrow = new THREE.Group();
zAxisArrow.add(shaft);
zAxisArrow.add(head);
platformGroup.add(zAxisArrow);

// Maze walls
const wallMaterial = new THREE.MeshPhongMaterial({
    color: 0x7f8c8d,
    shininess: 20
});
const wallHeight = 0.5;
const wallThickness = 0.3;

// Simple maze layout
const walls = [
    // Vertical walls
    { pos: [-2, wallHeight/2, -2], size: [wallThickness, wallHeight, 4] },
    { pos: [2, wallHeight/2, 2], size: [wallThickness, wallHeight, 4] },
    { pos: [0, wallHeight/2, 0], size: [wallThickness, wallHeight, 3] },
    // Horizontal walls
    { pos: [-3, wallHeight/2, 1], size: [3, wallHeight, wallThickness] },
    { pos: [1, wallHeight/2, -3], size: [4, wallHeight, wallThickness] }
];

const wallMeshes = [];
const wallData = [];
walls.forEach(wall => {
    const geometry = new THREE.BoxGeometry(...wall.size);
    const mesh = new THREE.Mesh(geometry, wallMaterial);
    mesh.position.set(...wall.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    platformGroup.add(mesh);
    wallMeshes.push({ mesh });
    const half = { x: wall.size[0] / 2, y: wall.size[1] / 2, z: wall.size[2] / 2 };
    wallData.push({
        center: new THREE.Vector3(wall.pos[0], wall.pos[1], wall.pos[2]),
        half: new THREE.Vector3(half.x, half.y, half.z)
    });
});

// Goal hole (cylinder)
const goalRadius = 0.6;
const goalGeometry = new THREE.CylinderGeometry(goalRadius, goalRadius, 0.1, 32);
const goalMaterial = new THREE.MeshPhongMaterial({
    color: 0x27ae60,
    emissive: 0x27ae60,
    emissiveIntensity: 0.35,
    shininess: 120,
    specular: 0xffffff
});
const goal = new THREE.Mesh(goalGeometry, goalMaterial);
goal.position.set(3.5, 0.05, 3.5);
goal.rotation.x = Math.PI / 2;
goal.receiveShadow = true;
platformGroup.add(goal);

// Collectibles (coins) and scoring
const coinRadius = 0.2;
const coinHeight = 0.15;
const coinMaterial = new THREE.MeshPhongMaterial({
    color: 0xffd700,
    emissive: 0x7f6500,
    emissiveIntensity: 0.4,
    shininess: 200,
    specular: 0xffffff
});
const coinPositions = [
    new THREE.Vector3(-2.5, coinHeight/2, -1.5),
    new THREE.Vector3(0.5, coinHeight/2, 1.0),
    new THREE.Vector3(2.5, coinHeight/2, -2.0),
    new THREE.Vector3(-1.0, coinHeight/2, 2.5)
];
const coins = [];
function spawnCoins() {
    for (const c of coins) platformGroup.remove(c.mesh);
    coins.length = 0;
    for (const p of coinPositions) {
        const geo = new THREE.CylinderGeometry(coinRadius, coinRadius, coinHeight, 24);
        const mesh = new THREE.Mesh(geo, coinMaterial);
        mesh.position.copy(p);
        mesh.rotation.x = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        platformGroup.add(mesh);
        coins.push({ mesh, taken: false });
    }
}
spawnCoins();

// Marble
const marbleRadius = 0.3;
const marbleGeometry = new THREE.SphereGeometry(marbleRadius, 32, 32);
const marbleMaterial = new THREE.MeshPhongMaterial({
    color: 0xff7aa2,
    shininess: 140,
    specular: 0xffffff,
    reflectivity: 0.9
});
const marble = new THREE.Mesh(marbleGeometry, marbleMaterial);
marble.castShadow = true;
platformGroup.add(marble);

// Marble physics state
const marbleState = {
    position: new THREE.Vector3(-3.5, marbleRadius, -3.5),
    velocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0)
};

// Physics constants
const GRAVITY = 20.0; // Increased for faster movement
const FRICTION = 0.96; // Reduced for less resistance
const BOUNCE_DAMPING = 0.5;
const ROLLING_RESISTANCE = 0.99;

// Platform tilt state
const platformTilt = {
    targetX: 0,
    targetZ: 0,
    currentX: 0,
    currentZ: 0,
    tiltSpeed: 0.02, // Speed of tilt change with arrow keys
    maxAngle: Math.PI / 2 // 90 degrees max (prevents upside-down)
};

// Arrow key state
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Game state
let gameWon = false;
let gameLost = false;
let gameStarted = false;
let timeRemaining = 90; // seconds (1:30)
let currentCameraView = 3; // Start with angled view

const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const winEl = document.getElementById('win-message');
const loseEl = document.getElementById('lose-message');
const startOverlayEl = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-button');
let score = 0;

// Camera views
const cameraViews = {
    0: { pos: [0, 15, 15], target: [0, 0, 0], orbit: true },  // Free orbit
    1: { pos: [0, 20, 0], target: [0, 0, 0], orbit: false },   // Top view
    2: { pos: [15, 5, 0], target: [0, 0, 0], orbit: false },   // Side view
    3: { pos: [10, 12, 10], target: [0, 0, 0], orbit: false }  // Angled view
};

// Initialize marble position
function resetMarble() {
    marbleState.position.set(-3.5, marbleRadius, -3.5);
    marbleState.velocity.set(0, 0, 0);
    marbleState.angularVelocity.set(0, 0, 0);
    gameWon = false;
    gameLost = false;
    gameStarted = false;
    timeRemaining = 90;
    score = 0;
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (timerEl) timerEl.textContent = '01:30';
    if (winEl) winEl.style.display = 'none';
    if (loseEl) loseEl.style.display = 'none';
    if (startOverlayEl) startOverlayEl.style.display = 'block';
    // Reset platform tilt and camera view
    platformTilt.targetX = platformTilt.targetZ = 0;
    platformTilt.currentX = platformTilt.currentZ = 0;
    setCameraView(3);
}

resetMarble();

// Set camera view
function setCameraView(viewNumber) {
    currentCameraView = viewNumber;
    const view = cameraViews[viewNumber];
    
    if (view.orbit) {
        controls.enabled = true;
        camera.position.set(...view.pos);
        controls.target.set(...view.target);
        controls.update();
    } else {
        controls.enabled = false;
        camera.position.set(...view.pos);
        camera.lookAt(...view.target);
    }
}

// Initialize with angled view
setCameraView(3);

// Show start overlay on load
if (startOverlayEl) startOverlayEl.style.display = 'block';
if (startBtn) startBtn.addEventListener('click', () => { gameStarted = true; startOverlayEl.style.display = 'none'; });
window.addEventListener('keydown', (e) => {
    if (!gameStarted && (e.code === 'Space' || e.key === ' ')) {
        gameStarted = true;
        if (startOverlayEl) startOverlayEl.style.display = 'none';
    }
});

// Keyboard events
window.addEventListener('keydown', (event) => {
    const key = event.key;
    
    // Arrow keys for platform tilt
    if (key in keys) {
        keys[key] = true;
    }
    
    // Camera view controls
    if (key >= '0' && key <= '3') {
        setCameraView(parseInt(key));
    } else if (key.toLowerCase() === 'r') {
        resetMarble();
    }
});

window.addEventListener('keyup', (event) => {
    const key = event.key;
    
    if (key in keys) {
        keys[key] = false;
    }
});

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Improved collision detection in platform local space
function checkWallCollisions() {
    for (let i = 0; i < wallData.length; i++) {
        const w = wallData[i];
        const c = marbleState.position; // already in platform local space
        const min = new THREE.Vector3(w.center.x - w.half.x, w.center.y - w.half.y, w.center.z - w.half.z);
        const max = new THREE.Vector3(w.center.x + w.half.x, w.center.y + w.half.y, w.center.z + w.half.z);
        const closest = new THREE.Vector3(
            Math.max(min.x, Math.min(c.x, max.x)),
            Math.max(min.y, Math.min(c.y, max.y)),
            Math.max(min.z, Math.min(c.z, max.z))
        );
        const delta = new THREE.Vector3().subVectors(c, closest);
        const dist = delta.length();
        if (dist < marbleRadius) {
            let normal = new THREE.Vector3();
            if (dist > 1e-6) {
                normal.copy(delta).normalize();
            } else {
                const dx = Math.min(Math.abs(c.x - min.x), Math.abs(max.x - c.x));
                const dz = Math.min(Math.abs(c.z - min.z), Math.abs(max.z - c.z));
                if (dx < dz) {
                    normal.set(Math.sign(c.x - w.center.x), 0, 0);
                } else {
                    normal.set(0, 0, Math.sign(c.z - w.center.z));
                }
            }
            const penetration = marbleRadius - dist + 0.001;
            marbleState.position.addScaledVector(normal, penetration);
            const vN = marbleState.velocity.dot(normal);
            if (vN < 0) {
                marbleState.velocity.sub(normal.multiplyScalar(vN * (1 + BOUNCE_DAMPING)));
            }
        }
    }
    
    // Check platform boundaries (walls)
    const halfSize = platformSize / 2 - marbleRadius;
    if (Math.abs(marbleState.position.x) > halfSize) {
        marbleState.position.x = Math.sign(marbleState.position.x) * halfSize;
        marbleState.velocity.x *= -BOUNCE_DAMPING;
    }
    if (Math.abs(marbleState.position.z) > halfSize) {
        marbleState.position.z = Math.sign(marbleState.position.z) * halfSize;
        marbleState.velocity.z *= -BOUNCE_DAMPING;
    }
    
    // Invisible ceiling to prevent ball from falling out at high tilts
    const ceilingHeight = 5.0; // Height of invisible ceiling
    if (marbleState.position.y > ceilingHeight) {
        marbleState.position.y = ceilingHeight;
        marbleState.velocity.y = 0;
    }
    
    // Keep marble on platform (floor constraint)
    if (marbleState.position.y < marbleRadius) {
        marbleState.position.y = marbleRadius;
        marbleState.velocity.y = 0;
    }
}

// Check win condition
function checkWinCondition() {
    const distanceToGoal = new THREE.Vector2(
        marbleState.position.x - goal.position.x,
        marbleState.position.z - goal.position.z
    ).length();
    
    if (distanceToGoal < goalRadius && !gameWon) {
        gameWon = true;
        if (winEl) winEl.style.display = 'block';
        playWinJingle();
        spawnConfetti(goal.position);
    }
}

// Simple audio beeps and win jingle
let audioCtx = null;
function playBeep(freq, duration) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration + 0.02);
    } catch {}
}
function playWinJingle() {
    playBeep(523.25, 0.12);
    setTimeout(() => playBeep(659.25, 0.12), 140);
    setTimeout(() => playBeep(783.99, 0.2), 280);
}

function checkCoins() {
    for (const c of coins) {
        if (c.taken) continue;
        const d = Math.hypot(marbleState.position.x - c.mesh.position.x, marbleState.position.z - c.mesh.position.z);
        if (d < marbleRadius + coinRadius * 0.8) {
            c.taken = true;
            platformGroup.remove(c.mesh);
            score += 10;
            if (scoreEl) scoreEl.textContent = `Score: ${score}`;
            playBeep(880, 0.08);
        }
    }
}

// Physics update
function updatePhysics(deltaTime) {
    if (gameWon || gameLost || !gameStarted) return;
    
    // Clamp delta time to prevent large jumps
    deltaTime = Math.min(deltaTime, 0.066);
    
    // Determine substeps based on speed to avoid tunneling
    const speed = marbleState.velocity.length();
    const desiredStep = Math.max(0.004, Math.min(0.016, (marbleRadius * 0.25) / (speed + 1e-3)));
    const steps = Math.max(1, Math.min(12, Math.ceil(deltaTime / desiredStep)));
    const dt = deltaTime / steps;
    
    for (let i = 0; i < steps; i++) {
        // Get platform rotation in world space
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(platformGroup.rotation);
        
        // Calculate gravity direction based on platform tilt
        const gravityDir = new THREE.Vector3(0, -1, 0);
        gravityDir.applyMatrix4(rotationMatrix);
        
        // Apply gravity force (project onto platform)
        const gravityForce = new THREE.Vector3(
            -gravityDir.x * GRAVITY,
            0,
            -gravityDir.z * GRAVITY
        );
        
        // Semi-implicit Euler integration
        marbleState.velocity.add(gravityForce.multiplyScalar(dt));
        marbleState.velocity.multiplyScalar(FRICTION);
        const prevPos = marbleState.position.clone();
        marbleState.position.add(marbleState.velocity.clone().multiplyScalar(dt));
        marbleState.position.y = marbleRadius;
        
        // Iterative collision resolution (walls and bounds)
        for (let iter = 0; iter < 2; iter++) {
            checkWallCollisions();
        }
        
        // Simple swept correction: if a large correction happened, damp velocity along that axis
        const delta = marbleState.position.clone().sub(prevPos);
        if (Math.abs(delta.x) < 1e-3 && Math.abs(marbleState.velocity.x) > 0) marbleState.velocity.x *= 0.7;
        if (Math.abs(delta.z) < 1e-3 && Math.abs(marbleState.velocity.z) > 0) marbleState.velocity.z *= 0.7;
        
        // Win check per substep
        checkWinCondition();
        if (gameWon) break;
    }

    // Update marble mesh position and rolling
    marble.position.copy(marbleState.position);
    const spd = marbleState.velocity.length();
    if (spd > 0.01) {
        const axis = new THREE.Vector3(-marbleState.velocity.z, 0, marbleState.velocity.x).normalize();
        const angle = spd * deltaTime / marbleRadius;
        marble.rotateOnWorldAxis(axis, angle);
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    
    // Timer update
    if (gameStarted && !gameWon && !gameLost) {
        timeRemaining -= deltaTime;
        if (timeRemaining <= 0) {
            timeRemaining = 0;
            gameLost = true;
            if (loseEl) loseEl.style.display = 'block';
        }
        if (timerEl) {
            const t = Math.max(0, Math.floor(timeRemaining));
            const m = Math.floor(t / 60).toString().padStart(2, '0');
            const s = (t % 60).toString().padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        }
    }
    
    // Update platform tilt based on arrow keys (bounded to prevent upside-down)
    if (keys.ArrowUp) {
        platformTilt.targetX = Math.max(platformTilt.targetX - platformTilt.tiltSpeed, -platformTilt.maxAngle);
    }
    if (keys.ArrowDown) {
        platformTilt.targetX = Math.min(platformTilt.targetX + platformTilt.tiltSpeed, platformTilt.maxAngle);
    }
    if (keys.ArrowLeft) {
        platformTilt.targetZ = Math.max(platformTilt.targetZ - platformTilt.tiltSpeed, -platformTilt.maxAngle);
    }
    if (keys.ArrowRight) {
        platformTilt.targetZ = Math.min(platformTilt.targetZ + platformTilt.tiltSpeed, platformTilt.maxAngle);
    }
    
    // Smoothly interpolate platform tilt
    platformTilt.currentX += (platformTilt.targetX - platformTilt.currentX) * 0.1;
    platformTilt.currentZ += (platformTilt.targetZ - platformTilt.currentZ) * 0.1;
    
    platformGroup.rotation.x = platformTilt.currentX;
    platformGroup.rotation.z = platformTilt.currentZ;
    
    // Update physics
    updatePhysics(deltaTime);
    // Collectibles check
    if (gameStarted && !gameWon && !gameLost) {
        checkCoins();
    }
    
    // Update point light position to follow marble
    pointLight.position.set(
        marbleState.position.x,
        marbleState.position.y + 3,
        marbleState.position.z
    );
    
    // Update controls if enabled
    if (controls.enabled) {
        controls.update();
    }
    
    renderer.render(scene, camera);
}

animate();

// Confetti particles on win
const confetti = { points: null, velocities: null, life: 0 };
function spawnConfetti(pos) {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.2;
        positions[i*3+0] = pos.x + Math.cos(angle) * r;
        positions[i*3+1] = pos.y + 0.2 + Math.random() * 0.2;
        positions[i*3+2] = pos.z + Math.sin(angle) * r;
        velocities[i*3+0] = (Math.random() - 0.5) * 1.2;
        velocities[i*3+1] = Math.random() * 1.5 + 0.5;
        velocities[i*3+2] = (Math.random() - 0.5) * 1.2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        colors[i*3+0] = 0.7 + 0.3*Math.random();
        colors[i*3+1] = 0.7 + 0.3*Math.random();
        colors[i*3+2] = 0.7 + 0.3*Math.random();
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 1.0 });
    if (confetti.points) platformGroup.remove(confetti.points);
    confetti.points = new THREE.Points(geom, mat);
    confetti.velocities = velocities;
    confetti.life = 2.0;
    platformGroup.add(confetti.points);
}

function updateConfetti(dt) {
    if (!confetti.points || confetti.life <= 0) return;
    confetti.life -= dt;
    const positions = confetti.points.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
        confetti.velocities[i*3+1] -= 3.0 * dt; // gravity
        positions.array[i*3+0] += confetti.velocities[i*3+0] * dt;
        positions.array[i*3+1] += confetti.velocities[i*3+1] * dt;
        positions.array[i*3+2] += confetti.velocities[i*3+2] * dt;
    }
    confetti.points.material.opacity = Math.max(0, confetti.life / 2.0);
    positions.needsUpdate = true;
    if (confetti.life <= 0) {
        platformGroup.remove(confetti.points);
        confetti.points.geometry.dispose();
        confetti.points.material.dispose();
        confetti.points = null;
    }
}
