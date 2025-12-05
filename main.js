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
renderer.domElement.tabIndex = 0;
renderer.domElement.focus();

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

function ensureLoseOptions() {
    if (!loseEl) return;
    // Find or create a Retry button and bind it to reload the current level
    let retry = loseEl.querySelector('#btn-lose-retry');
    if (!retry) {
        retry = loseEl.querySelector('button') || document.createElement('button');
        retry.id = 'btn-lose-retry';
        retry.textContent = 'Retry';
        if (!retry.parentElement) {
            const actions = loseEl.querySelector('.overlay-actions') || loseEl;
            actions.appendChild(retry);
        }
    }
    try { retry.removeAttribute('onclick'); } catch (e) {}
    retry.onclick = null;
    retry.addEventListener('click', () => {
        loseEl.style.display = 'none';
        loadLevel(currentLevel);
    });
}

scene.background = createGradientBackground();

// Textures (load asynchronously and only apply on success)
const textureLoader = new THREE.TextureLoader();
let woodTex = null;
try {
    textureLoader.load('885.jpg', (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 3);
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
const ambientLight = new THREE.AmbientLight(0x404040, 0.65);
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

const pointLight = new THREE.PointLight(0xffffff, 0.7, 50);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);


// Platform group (will be rotated for tilt)
const platformGroup = new THREE.Group();
scene.add(platformGroup);

// Platform
let platformSizeCurrent = 10;
const platformSizeBase = 10;
let platformGeometry = new THREE.BoxGeometry(platformSizeCurrent, 0.5, platformSizeCurrent);
const platformMaterial = new THREE.MeshPhongMaterial({
    color: 0x8d5524,
    shininess: 35
});
let platform = new THREE.Mesh(platformGeometry, platformMaterial);
platform.position.y = -0.25;
platform.receiveShadow = true;
platformGroup.add(platform);
// If texture was already loaded before mesh creation, apply it now
if (woodTex) {
    platform.material.map = woodTex;
    platform.material.needsUpdate = true;
}

function rebuildPlatform(newSize) {
    // Remove old platform and borders
    if (platform) {
        platformGroup.remove(platform);
        platform.geometry.dispose();
    }
    for (const b of borderMeshes) {
        platformGroup.remove(b);
        if (b.geometry) b.geometry.dispose();
        if (b.material) b.material.dispose?.();
    }
    borderMeshes.length = 0;
    platformSizeCurrent = newSize;
    // Create new platform
    platformGeometry = new THREE.BoxGeometry(platformSizeCurrent, 0.5, platformSizeCurrent);
    platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = -0.25;
    platform.receiveShadow = true;
    platformGroup.add(platform);
    if (woodTex) {
        platform.material.map = woodTex;
        platform.material.needsUpdate = true;
    }
    // Rebuild borders with updated positions/sizes
    const borderHeight = 0.5;
    const borderThickness = 0.3;
    borders = [
        // North/South: shorten length so they butt against vertical borders without overlap
        { pos: [0, borderHeight/2, -platformSizeCurrent/2], size: [platformSizeCurrent - borderThickness, borderHeight, borderThickness], color: 0xff0000 },
        { pos: [0, borderHeight/2, platformSizeCurrent/2], size: [platformSizeCurrent - borderThickness, borderHeight, borderThickness], color: 0xff8800 },
        // East/West: shorten length so they butt against horizontal borders without overlap
        { pos: [platformSizeCurrent/2, borderHeight/2, 0], size: [borderThickness, borderHeight, platformSizeCurrent - borderThickness], color: 0x0000aa },
        { pos: [-platformSizeCurrent/2, borderHeight/2, 0], size: [borderThickness, borderHeight, platformSizeCurrent - borderThickness], color: 0x00aaaa }
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
        borderMeshes.push(mesh);
    });
}

// Platform border with color coding
const borderHeight = 0.5;
const borderThickness = 0.3;

// Create borders with unique color for each side
// North (Up arrow) = Red, South (Down arrow) = Orange
// West (Left arrow) = Teal, East (Right arrow) = Dark Blue
const borderMeshes = [];
let borders = [
    // North (Red - controlled by Up arrow)
    { pos: [0, borderHeight/2, -platformSizeCurrent/2], size: [platformSizeCurrent - borderThickness, borderHeight, borderThickness], color: 0xff0000 },
    // South (Orange - controlled by Down arrow)
    { pos: [0, borderHeight/2, platformSizeCurrent/2], size: [platformSizeCurrent - borderThickness, borderHeight, borderThickness], color: 0xff8800 },
    // East (Dark Blue - controlled by Right arrow)
    { pos: [platformSizeCurrent/2, borderHeight/2, 0], size: [borderThickness, borderHeight, platformSizeCurrent - borderThickness], color: 0x0000aa },
    // West (Teal - controlled by Left arrow)
    { pos: [-platformSizeCurrent/2, borderHeight/2, 0], size: [borderThickness, borderHeight, platformSizeCurrent - borderThickness], color: 0x00aaaa }
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
    borderMeshes.push(mesh);
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
    color: 0x616a6b,
    shininess: 12,
    specular: 0x111111
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

let goalGlow = null;
{
    const glowGeom = new THREE.CylinderGeometry(goalRadius * 1.6, goalRadius * 1.6, 0.02, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x27ae60,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    goalGlow = new THREE.Mesh(glowGeom, glowMat);
    goalGlow.position.copy(goal.position);
    goalGlow.rotation.x = goal.rotation.x;
    goalGlow.renderOrder = 1;
    platformGroup.add(goalGlow);
    goal.userData.glow = goalGlow;
}

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
        // store base Y and a random phase so each coin bobs slightly out of sync
        const baseY = mesh.position.y;
        const phase = Math.random() * Math.PI * 2;
        coins.push({ mesh, taken: false, baseY, phase });
    }
}
spawnCoins();

let currentLevel = 1;
const spikes = [];
const movingObstacles = [];

function clearLevelExtras() {
    for (const w of wallMeshes) {
        platformGroup.remove(w.mesh);
    }
    wallMeshes.length = 0;
    wallData.length = 0;
    for (const c of coins) {
        platformGroup.remove(c.mesh);
    }
    coins.length = 0;
    for (const s of spikes) {
        platformGroup.remove(s.mesh);
    }
    spikes.length = 0;
    for (const m of movingObstacles) {
        platformGroup.remove(m.mesh);
    }
    movingObstacles.length = 0;
}

function spawnCoinsAt(positions) {
    for (const c of coins) platformGroup.remove(c.mesh);
    coins.length = 0;
    for (const p of positions) {
        const geo = new THREE.CylinderGeometry(coinRadius, coinRadius, coinHeight, 24);
        const mesh = new THREE.Mesh(geo, coinMaterial);
        mesh.position.copy(p);
        mesh.rotation.x = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        platformGroup.add(mesh);
        const baseY = mesh.position.y;
        const phase = Math.random() * Math.PI * 2;
        coins.push({ mesh, taken: false, baseY, phase });
    }
}

function buildWalls(defs) {
    for (const w of defs) {
        const geometry = new THREE.BoxGeometry(...w.size);
        const mesh = new THREE.Mesh(geometry, wallMaterial);
        mesh.position.set(...w.pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        platformGroup.add(mesh);
        // add thin outline for definition
        try {
            const egeo = new THREE.EdgesGeometry(geometry, 30);
            const eline = new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({ color: 0x000000 }));
            eline.position.set(0, 0, 0);
            mesh.add(eline);
        } catch (e) {}
        wallMeshes.push({ mesh });
        const half = { x: w.size[0] / 2, y: w.size[1] / 2, z: w.size[2] / 2 };
        wallData.push({
            center: new THREE.Vector3(w.pos[0], w.pos[1], w.pos[2]),
            half: new THREE.Vector3(half.x, half.y, half.z)
        });
    }
}

function spawnSpikes(positions) {
    for (const p of positions) {
        const coneGeo = new THREE.ConeGeometry(0.25, 0.4, 12);
        const mat = new THREE.MeshPhongMaterial({ color: 0xff6600, shininess: 80, specular: 0x222222});
        const mesh = new THREE.Mesh(coneGeo, mat);
        mesh.position.set(p.x, 0.2, p.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // single white stripe around the cone
        (function addStripe(spikeMesh) {
            const baseRadius = 0.15;
            const t = 0.25; // fraction up the cone where stripe sits (0 = base, 1 = apex)
            const stripeRadius = Math.max(baseRadius * (1 - t), 0.05);
            const tube = 0.02;

            const stripeGeo = new THREE.TorusGeometry(stripeRadius, tube, 8, 40);
            const stripeMat = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                shininess: 80,
                emissive: 0xffffff,
                emissiveIntensity: 0.05
            });
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            // orient horizontal ring and position relative to cone base (ConeGeometry base is at y=0)
            stripe.rotation.x = Math.PI / 2;
            stripe.position.set(0, 0, 0);
            stripe.renderOrder = 2;
            stripe.castShadow = false;
            stripe.receiveShadow = false;
            spikeMesh.add(stripe);
        })(mesh);

        platformGroup.add(mesh);
        spikes.push({ mesh, radius: 0.23 });
    }
}

function spawnMovingObstacles(defs) {
    const loader = new THREE.TextureLoader();
    const truckTexture = loader.load('truck.png');

    for (const d of defs) {
        const geo = new THREE.BoxGeometry(...d.size);
        const mat = new THREE.MeshPhongMaterial({
            map: truckTexture,
            shininess: 40
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        platformGroup.add(mesh);

        // outline for readability
        try {
            const egeo = new THREE.EdgesGeometry(geo, 30);
            const eline = new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({ color: 0x2d1452 }));
            eline.position.set(0, 0, 0);
            mesh.add(eline);
        } catch(e) {}

        movingObstacles.push({
            mesh,
            axis: d.axis,
            range: d.range,
            speed: d.speed,
            base: new THREE.Vector3(d.pos[0], d.pos[1], d.pos[2]),
            half: new THREE.Vector3(d.size[0]/2, d.size[1]/2, d.size[2]/2),
            t: 0
        });

        wallMeshes.push({ mesh });
        wallData.push({ center: mesh.position.clone(), half: new THREE.Vector3(d.size[0]/2, d.size[1]/2, d.size[2]/2) });
    }
}


function updateMovingObstacles(dt) {
    let idx = 0;
    for (let i = 0; i < movingObstacles.length; i++) {
        const m = movingObstacles[i];
        m.t += dt * m.speed;
        const s = Math.sin(m.t) * m.range;
        if (m.axis === 'x') meshSet(m.mesh, m.base.x + s, m.base.y, m.base.z);
        else if (m.axis === 'z') meshSet(m.mesh, m.base.x, m.base.y, m.base.z + s);
        else meshSet(m.mesh, m.base.x, m.base.y + s, m.base.z);
    }
    let wdi = 0;
    for (let i = 0; i < wallMeshes.length; i++) {
        const wm = wallMeshes[i];
        const wd = wallData[wdi];
        if (wd && wm && wm.mesh) {
            wd.center.copy(wm.mesh.position);
        }
        wdi++;
    }
}

function meshSet(mesh, x, y, z) {
    mesh.position.set(x, y, z);
}

function loadLevel(level) {
    clearLevelExtras();
    // Resize platform per level
    if (level === 1) {
        rebuildPlatform(platformSizeBase);
        currentLevel = 1;
        buildWalls([
            { pos: [-2, 0.25, -2], size: [0.3, 0.5, 4] },
            { pos: [2, 0.25, 2], size: [0.3, 0.5, 4] },
            { pos: [0, 0.25, 0], size: [0.3, 0.5, 3] },
            { pos: [-3, 0.25, 1], size: [3, 0.5, 0.3] },
            { pos: [1, 0.25, -3], size: [4, 0.5, 0.3] }
        ]);
        spawnCoins();
        goal.position.set(3.5, 0.05, 3.5);
    } else if (level === 2) {
        // Increase platform for level 2 (20% larger by default)
        rebuildPlatform(platformSizeBase * 1.2);
        currentLevel = 2;
        // Build spiral using platform size with wider corridors and thinner walls
        const h = platformSizeCurrent / 2;
        const clr = 1.1; // larger clearance from borders
        const t = 0.25;  // thinner walls
        const y = 0.25;  // wall center Y
        const defs = [];
        // Outer ring with west entrance gap and added gaps in north (top), south (bottom) and east (right) walls
        // North (split with center gap)
        {
            const gapW = 1.4, cx = 0;
            const xMin = -h + clr, xMax = h - clr;
            const leftLen = (cx - gapW/2) - xMin;
            const rightLen = xMax - (cx + gapW/2);
            if (leftLen > 0.05) defs.push({ pos: [xMin + leftLen/2, y, h - clr], size: [leftLen, 0.5, t] });
            if (rightLen > 0.05) defs.push({ pos: [cx + gapW/2 + rightLen/2, y, h - clr], size: [rightLen, 0.5, t] });
        }
        // South (split with center gap)
        {
            const gapW = 1.4, cx = 0;
            const xMin = -h + clr, xMax = h - clr;
            const leftLen = (cx - gapW/2) - xMin;
            const rightLen = xMax - (cx + gapW/2);
            if (leftLen > 0.05) defs.push({ pos: [xMin + leftLen/2, y, -h + clr], size: [leftLen, 0.5, t] });
            if (rightLen > 0.05) defs.push({ pos: [cx + gapW/2 + rightLen/2, y, -h + clr], size: [rightLen, 0.5, t] });
        }
        // East (split with mid-lower gap)
        {
            const gapW = 1.4, cz = -1.0;
            const zMin = -h + clr, zMax = h - clr;
            const seg1Len = (cz - gapW/2) - zMin;
            const seg2Len = zMax - (cz + gapW/2);
            if (seg1Len > 0.05) defs.push({ pos: [h - clr, y, zMin + seg1Len/2], size: [t, 0.5, seg1Len] });
            if (seg2Len > 0.05) defs.push({ pos: [h - clr, y, cz + gapW/2 + seg2Len/2], size: [t, 0.5, seg2Len] });
        }
        // West split (wider entrance area)
        defs.push({ pos: [-h + clr, y, 0.8], size: [t, 0.5, h - 0.4] });
        defs.push({ pos: [-h + clr, y, -h + 1.6], size: [t, 0.5, 2.2] });
        // Spiral inward segments (more room between)
        defs.push({ pos: [0, y, h - 2.6], size: [platformSizeCurrent - 4.2, 0.5, t] });
        defs.push({ pos: [h - 2.6, y, 0], size: [t, 0.5, platformSizeCurrent - 5.0] });
        // Bottom-most inner horizontal (reverted to single piece)
        defs.push({ pos: [0, y, -h + 2.0], size: [platformSizeCurrent - 5.2, 0.5, t] });
        defs.push({ pos: [-h + 2.4, y, 0], size: [t, 0.5, platformSizeCurrent - 6.2] });
        defs.push({ pos: [0, y, 0.8], size: [platformSizeCurrent - 8.2, 0.5, t] });
        buildWalls(defs);
        // Spikes (offset further from walls and center) — remove the center-top spike near the red wall
        spawnSpikes([
            new THREE.Vector3(-h + 1.6, 0, h - 2.0),
            new THREE.Vector3(h - 1.8, 0, h - 2.2),
            new THREE.Vector3(h - 2.0, 0, -1.0),
            new THREE.Vector3(-1.2, 0, -2.2),
            new THREE.Vector3(h - 6, 0, h - 4),
            new THREE.Vector3(1.1, 0, 0.0)     
        ]);
        // Coins (optional, safe spots away from spikes); removed the middle coin that intersected a wall
        spawnCoinsAt([
            new THREE.Vector3(-h + 2.2, coinHeight/2, h - 2.6),
            new THREE.Vector3(-0.8, coinHeight/2, -0.8),
            new THREE.Vector3(-h + 1.6, coinHeight/2, -h + 1.8),
            new THREE.Vector3(h - 1.8, coinHeight/2, -h + 2.0),
            new THREE.Vector3(0.0, coinHeight/2, h - 2.2),
            new THREE.Vector3(1.6, coinHeight/2, 2)
        ]);
        // Goal at center
        goal.position.set(0.0, 0.05, 0.0);
    } else if (level === 3) {
        // Level 3: bigger platform than level 2, wider corridors, denser spiral, moving obstacles
        rebuildPlatform(platformSizeBase * 1.35);
        currentLevel = 3;
        const h = platformSizeCurrent / 2;
        const clr = 1.3;   // more border clearance => wider outer corridors
        const t = 0.25;    // thin walls to maximize corridor width
        const y = 0.25;
        const defs = [];
        // Outer ring with multiple gaps (north, east-upper, east-mid, south)
        // North split
        {
            const gapW = 1.4, cx = -0.6;
            const xMin = -h + clr, xMax = h - clr;
            const leftLen = (cx - gapW/2) - xMin;
            const rightLen = xMax - (cx + gapW/2);
            if (leftLen > 0.05) defs.push({ pos: [xMin + leftLen/2, y, h - clr], size: [leftLen, 0.5, t] });
            if (rightLen > 0.05) defs.push({ pos: [cx + gapW/2 + rightLen/2, y, h - clr], size: [rightLen, 0.5, t] });
        }
        // South split (mid gap)
        {
            const gapW = 1.6, cx = 0.8;
            const xMin = -h + clr, xMax = h - clr;
            const leftLen = (cx - gapW/2) - xMin;
            const rightLen = xMax - (cx + gapW/2);
            if (leftLen > 0.05) defs.push({ pos: [xMin + leftLen/2, y, -h + clr], size: [leftLen, 0.5, t] });
            if (rightLen > 0.05) defs.push({ pos: [cx + gapW/2 + rightLen/2, y, -h + clr], size: [rightLen, 0.5, t] });
        }
        // East splits: add two holes (upper and mid) on the outer east wall
        {
            const zMin = -h + clr, zMax = h - clr;
            const gaps = [
                { cz: 1.6, w: 1.6 }, // upper gap
                { cz: 0.0, w: 1.2 }  // mid gap
            ].sort((a,b)=>a.cz-b.cz);
            let cursor = zMin;
            for (let i = 0; i < gaps.length; i++) {
                const cz = gaps[i].cz, w = gaps[i].w;
                const segEnd = cz - w/2;
                const segLen = segEnd - cursor;
                if (segLen > 0.05) defs.push({ pos: [h - clr, y, cursor + segLen/2], size: [t, 0.5, segLen] });
                cursor = cz + w/2;
            }
            const tailLen = zMax - cursor;
            if (tailLen > 0.05) defs.push({ pos: [h - clr, y, cursor + tailLen/2], size: [t, 0.5, tailLen] });
        }
        // West split entrance retained
        defs.push({ pos: [-h + clr, y, 1.2], size: [t, 0.5, h - 0.8] });
        defs.push({ pos: [-h + clr, y, -h + 1.8], size: [t, 0.5, 2.4] });
        // Inner spirals wider and denser (added segments) with holes for alternate routes
        // Top inner horizontal at z = h-2.8 with a gap near center-right
        {
            const L = platformSizeCurrent - 4.6;
            const gapW = 1.2, cx = 0.2;
            const xMin = -L/2, xMax = L/2;
            const leftLen = (cx - gapW/2) - xMin;
            const rightLen = xMax - (cx + gapW/2);
            if (leftLen > 0.05) defs.push({ pos: [xMin + leftLen/2, y, h - 2.8], size: [leftLen, 0.5, t] });
            if (rightLen > 0.05) defs.push({ pos: [cx + gapW/2 + rightLen/2, y, h - 2.8], size: [rightLen, 0.5, t] });
        }
        // Right inner vertical at x = h-2.8 with a mid gap
        {
            const H = platformSizeCurrent - 5.2;
            const gapW = 1.0, cz = 0.6;
            const zMin = -H/2, zMax = H/2;
            const lowerLen = (cz - gapW/2) - zMin;
            const upperLen = zMax - (cz + gapW/2);
            if (lowerLen > 0.05) defs.push({ pos: [h - 2.8, y, zMin + lowerLen/2], size: [t, 0.5, lowerLen] });
            if (upperLen > 0.05) defs.push({ pos: [h - 2.8, y, cz + gapW/2 + upperLen/2], size: [t, 0.5, upperLen] });
        }
        // Bottom inner horizontal at z = -h+2.4 with a gap slightly right of center
        {
            const L = platformSizeCurrent - 5.8;
            const gapW = 1.2, cx = 0.8;
            const xMin = -L/2, xMax = L/2;
            const leftLen = (cx - gapW/2) - xMin;
            const rightLen = xMax - (cx + gapW/2);
            if (leftLen > 0.05) defs.push({ pos: [xMin + leftLen/2, y, -h + 2.4], size: [leftLen, 0.5, t] });
            if (rightLen > 0.05) defs.push({ pos: [cx + gapW/2 + rightLen/2, y, -h + 2.4], size: [rightLen, 0.5, t] });
        }
        defs.push({ pos: [-h + 2.4, y, 0], size: [t, 0.5, platformSizeCurrent - 6.6] });
        // Middle inner horizontal at z = 0.8 with a gap toward the right side
        {
            const L = platformSizeCurrent - 8.8;
            const gapW = 1.2, cx = 1.6;
            const xMin = -L/2, xMax = L/2;
            const leftLen = (cx - gapW/2) - xMin;
            const rightLen = xMax - (cx + gapW/2);
            if (leftLen > 0.05) defs.push({ pos: [xMin + leftLen/2, y, 0.8], size: [leftLen, 0.5, t] });
            if (rightLen > 0.05) defs.push({ pos: [cx + gapW/2 + rightLen/2, y, 0.8], size: [rightLen, 0.5, t] });
        }
        defs.push({ pos: [h - 3.6, y, 0.4], size: [t, 0.5, 2.0] }); // small inner post to force pathing
        buildWalls(defs);
        // Moving obstacles: three purple bars that run along corridors adjacent to walls
        // m1: runs horizontally along the corridor below the north inner wall
        // m2: runs vertically along the right-side inner corridor
        // m3: runs horizontally along the corridor above the south inner wall
        // m4: NEW – centered horizontal runner just below the central spike area
        spawnMovingObstacles([
            { pos: [0.0, 0.25, h - 3.4], size: [1.4, 0.5, 0.3], axis: 'x', range: 2.0, speed: 2.1 },
            { pos: [h - 3.2, 0.25, 0.0], size: [0.3, 0.5, 1.3], axis: 'z', range: 2.0, speed: 1.9 },
            { pos: [0.0, 0.25, -h + 2.8], size: [1.2, 0.5, 0.3], axis: 'x', range: 1.8, speed: 2.2 },
            { pos: [0.0, 0.25, 0.2], size: [1.0, 0.5, 0.3], axis: 'x', range: 1.2, speed: 2.1 }
        ]);
        // Spikes: more and slightly closer to paths, still with clearance
        spawnSpikes([
            new THREE.Vector3(-h + 1.8, 0, h - 2.0),
            new THREE.Vector3(h - 1.8, 0, h - 2.2),
            new THREE.Vector3(h - 2.2, 0, -1.2),
            new THREE.Vector3(-1.4, 0, -2.2),
            new THREE.Vector3(0.0, 0, -h + 1.8),
            new THREE.Vector3(-0.2, 0, 1.2)
        ]);
        // Coins in safe locations away from bar sweep
        spawnCoinsAt([
            new THREE.Vector3(-h + 2.6, coinHeight/2, h - 2.6),
            new THREE.Vector3(h - 2.6, coinHeight/2, 1.0),
            new THREE.Vector3(-1.0, coinHeight/2, -1.0),
            new THREE.Vector3(1.2, coinHeight/2, 2.0),
            new THREE.Vector3(0.0, coinHeight/2, -2.6),
            new THREE.Vector3(-2.2, coinHeight/2, 0.6)
        ]);
        // Goal at center
        goal.position.set(0.0, 0.05, 0.0);
    }
    resetMarble();
}

// Marble
const marbleRadius = 0.3;
const marbleGeometry = new THREE.SphereGeometry(marbleRadius, 32, 32);
const marbleMaterial = new THREE.MeshPhongMaterial({
    color: 0xfce6ef,
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
    maxAngle: Math.PI / 6 // ~30 degrees max tilt per axis
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
let isPaused = false;
let timeRemaining = 90; // seconds (1:30)
let currentCameraView = 3; // Start with angled view
let startButtonClicked = false; // Only allow pause after Start button is clicked

const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const winEl = document.getElementById('win-message');
const loseEl = document.getElementById('lose-message');
const startOverlayEl = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-button');
let score = 0;
let coinsCollected = 0;

function setOverlayMessage(msg, showStartButton = false) {
    if (!startOverlayEl) return;
    let msgEl = startOverlayEl.querySelector('.overlay-msg');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'overlay-msg';
        msgEl.style.color = '#fff';
        msgEl.style.fontFamily = 'system-ui, sans-serif';
        msgEl.style.fontSize = '20px';
        msgEl.style.textAlign = 'center';
        msgEl.style.marginBottom = '8px';
        // Insert message at top of overlay so any start button (if present) stays visible
        startOverlayEl.insertBefore(msgEl, startOverlayEl.firstChild);
    }
    if (msg) {
        msgEl.textContent = msg;
        // Also update the static paragraph to generic allowed-time phrasing when pausing
        const p = startOverlayEl.querySelector('p');
        if (p) p.textContent = 'Reach the goal within the allowed time.';
        startOverlayEl.style.display = 'block';
    } else {
        startOverlayEl.style.display = 'none';
    }
    if (startBtn) startBtn.style.display = showStartButton ? 'inline-block' : 'none';
}

// High score UI (per-level, session-only) and helpers
let highScoreEl = document.getElementById('high-score');
function styleHudItem(el) {
    if (!el) return;
    el.style.margin = '0';
    el.style.padding = '4px 8px';
    el.style.background = 'rgba(0,0,0,0.25)';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
    el.style.display = 'inline-block';
    el.style.minWidth = '120px';
}
// Create a unified top-center HUD bar for timer, score, high score
let topBar = document.getElementById('hud-topbar');
if (!topBar) {
    topBar = document.createElement('div');
    topBar.id = 'hud-topbar';
    topBar.style.position = 'fixed';
    topBar.style.top = '12px';
    topBar.style.left = '50%';
    topBar.style.transform = 'translateX(-50%)';
    topBar.style.zIndex = '1000';
    topBar.style.background = 'rgba(0,0,0,0.75)';
    topBar.style.color = '#fff';
    topBar.style.fontFamily = 'system-ui, sans-serif';
    topBar.style.padding = '6px 10px';
    topBar.style.borderRadius = '10px';
    topBar.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
    topBar.style.display = 'inline-flex';
    topBar.style.alignItems = 'center';
    topBar.style.gap = '12px';
    topBar.style.backdropFilter = 'none';
    document.body.appendChild(topBar);
}
// Ensure timer and score exist, style them and move into the top bar
if (timerEl) {
    styleHudItem(timerEl);
    timerEl.style.fontWeight = '700';
    timerEl.style.color = '#fff';
    timerEl.style.opacity = '1';
    timerEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
    timerEl.style.filter = 'none';
    timerEl.style.mixBlendMode = 'normal';
    timerEl.textContent = timerEl.textContent || '01:30';
    topBar.appendChild(timerEl);
}
if (scoreEl) {
    styleHudItem(scoreEl);
    scoreEl.style.fontWeight = '700';
    scoreEl.style.color = '#fff';
    scoreEl.style.opacity = '1';
    scoreEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
    scoreEl.style.filter = 'none';
    scoreEl.style.mixBlendMode = 'normal';
    scoreEl.textContent = 'Score: 0';
    topBar.appendChild(scoreEl);
}
if (!highScoreEl) {
    highScoreEl = document.createElement('div');
    highScoreEl.id = 'high-score';
}
styleHudItem(highScoreEl);
highScoreEl.style.fontWeight = '700';
highScoreEl.style.color = '#fff';
highScoreEl.style.opacity = '1';
highScoreEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
highScoreEl.style.filter = 'none';
highScoreEl.style.mixBlendMode = 'normal';
highScoreEl.textContent = 'High: 0';
topBar.appendChild(highScoreEl);

function hsKey(level) { return `maze_highscore_level_${level}`; }
const sessionHigh = {};
function getHighScore(level) { return sessionHigh[level] || 0; }
function setHighScore(level, val) { sessionHigh[level] = val; }
function updateHighScoreUI() {
    const hs = getHighScore(currentLevel);
    if (highScoreEl) highScoreEl.textContent = `High: ${hs}`;
}
function updateHighScoreIfNeeded() {
    const hs = getHighScore(currentLevel);
    if (score > hs) { setHighScore(currentLevel, score); updateHighScoreUI(); }
}

// Spike cooldown to prevent immediate re-trigger after respawn
let spikeCooldown = 0;

// Camera views
const cameraViews = {
    0: { pos: [0, 15, 15], target: [0, 0, 0], orbit: true },  // Free orbit
    1: { pos: [0, 20, 0], target: [0, 0, 0], orbit: false },   // Top view
    2: { pos: [15, 5, 0], target: [0, 0, 0], orbit: false },   // Side view
    3: { pos: [10, 12, 10], target: [0, 0, 0], orbit: false }  // Angled view
};

// Per-level spawn points
function levelSpawn(level) {
    if (level === 2 || level === 3) return new THREE.Vector3(-platformSizeCurrent/2 + 0.8, marbleRadius, platformSizeCurrent/2 - 0.8); // top-left near corner with clearance
    return new THREE.Vector3(-3.5, marbleRadius, -3.5); // default for level 1
}

// Lightweight spawn reset (used for spikes)
function resetToSpawnOnly() {
    const sp = levelSpawn(currentLevel);
    marbleState.position.copy(sp);
    marbleState.velocity.set(0, 0, 0);
    marbleState.angularVelocity.set(0, 0, 0);
    // Keep tilt, timer, score, and overlays as-is
}

// Initialize marble position
function resetMarble() {
    const sp = levelSpawn(currentLevel);
    marbleState.position.copy(sp);
    marbleState.velocity.set(0, 0, 0);
    marbleState.angularVelocity.set(0, 0, 0);
    // Immediately sync the visible marble mesh to the spawn position
    if (typeof marble !== 'undefined' && marble && marble.position) {
        marble.position.copy(sp);
        marble.quaternion.set(0, 0, 0, 1);
        marble.updateMatrixWorld(true);
    }
    gameWon = false;
    gameLost = false;
    gameStarted = false;
    // Per-level start timers
    if (currentLevel === 1) {
        timeRemaining = 60;
    } else if (currentLevel === 2) {
        timeRemaining = 90;
    } else {
        timeRemaining = 120;
    }
    score = 0;
    coinsCollected = 0;
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (timerEl) {
        const mins = Math.floor(timeRemaining / 60).toString().padStart(1, '0');
        const secs = (timeRemaining % 60).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }
    if (winEl) winEl.style.display = 'none';
    if (loseEl) loseEl.style.display = 'none';
    // Show the overlay with initial start message and show the start button
    setOverlayMessage('Press Space to Start', true);
    // Reset platform tilt and camera view
    platformTilt.targetX = platformTilt.targetZ = 0;
    platformTilt.currentX = platformTilt.currentZ = 0;
    setCameraView(3);
    // Clear any confetti from a previous win
    clearConfetti();
    // Respawn collectibles for Level 1 only
    if (currentLevel === 1 && typeof spawnCoins === 'function') {
        spawnCoins();
    }
    // Refresh high score display for current level
    updateHighScoreUI();
}

resetMarble();

// Set camera view
function setCameraView(viewNumber) {
    currentCameraView = viewNumber;
    const view = cameraViews[viewNumber];
    
    if (view && view.orbit) {
        controls.enabled = true;
        camera.position.set(...view.pos);
        controls.target.set(...view.target);
        controls.update();
    } else {
        controls.enabled = false;
        camera.position.set(...(view?.pos || [0, 15, 15]));
        const tgt = view?.target || [0, 0, 0];
        camera.lookAt(...tgt);
    }
    renderer.domElement?.focus?.();
}

// Initialize with angled view
setCameraView(3);

// Show start overlay on load
if (startOverlayEl) startOverlayEl.style.display = 'block';
if (startBtn) startBtn.addEventListener('click', () => { startButtonClicked = true; gameStarted = true; startOverlayEl.style.display = 'none'; renderer.domElement?.focus?.(); });
window.addEventListener('keydown', (e) => {
    if (!gameStarted && (e.code === 'Space' || e.key === ' ')) {
        gameStarted = true;
        isPaused = false;
        if (startOverlayEl) startOverlayEl.style.display = 'none';
        e.preventDefault();
    }
    else if (gameStarted && (e.code === 'Space' || e.key === ' ')) {
        // Toggle pause/resume
        if (startButtonClicked) {
            isPaused = !isPaused;
            if (isPaused) {
                setOverlayMessage('Game paused. Press space to resume.', false);
            } else {
                setOverlayMessage('', false);
            }
        }
        e.preventDefault();
    }
});

// Keyboard controls
document.addEventListener('keydown', (event) => {
    const key = event.key; // preserve ArrowUp/ArrowDown etc.
    const lower = key.toLowerCase();
    
    if (key === 'Escape' || key === 'Esc' || key == 'e') {
        // If resetting during a pause, unpause and hide overlay
        if (isPaused) {
            isPaused = false;
            setOverlayMessage('', false);
        }
        loadLevel(1);
        event.preventDefault();
        return;
    }

    // Arrow keys for platform tilt
    if (key in keys) {
        keys[key] = true;
        event.preventDefault();
    }
    
    // Camera view controls
    if (lower >= '0' && lower <= '3') {
        setCameraView(parseInt(lower));
        event.preventDefault();
    } else if (lower === 'r') {
        // If resetting during a pause, unpause and hide overlay
        if (isPaused) {
            isPaused = false;
            setOverlayMessage('', false);
        }
        resetMarble();
        event.preventDefault();
    }
    // Dev: cycle levels with 'N'
    if (lower === 'n') {
        const next = currentLevel >= 3 ? 1 : currentLevel + 1;
        loadLevel(next);
        event.preventDefault();
    }
});

window.addEventListener('keyup', (event) => {
    const key = event.key;
    if (key in keys) {
        keys[key] = false;
        event.preventDefault();
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
    const halfSize = platformSizeCurrent / 2 - marbleRadius;
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
function ensureWinOptions() {
    if (!winEl) return;
    let container = winEl.querySelector('#win-actions');
    if (!container) {
        container = document.createElement('div');
        container.id = 'win-actions';
        container.style.marginTop = '10px';
        container.style.display = 'flex';
        container.style.gap = '8px';
        // Reuse an existing 'Play Again' button if present, otherwise create
        let replay = winEl.querySelector('#btn-replay');
        if (!replay) {
            replay = document.createElement('button');
            replay.id = 'btn-replay';
            replay.textContent = 'Play Again';
        }
        let next = winEl.querySelector('#btn-next');
        if (!next) {
            next = document.createElement('button');
            next.id = 'btn-next';
            next.textContent = 'Next Level';
        }
        container.appendChild(replay);
        container.appendChild(next);
        winEl.appendChild(container);
        replay.addEventListener('click', () => {
            // Reload current level layout and reset fully
            loadLevel(currentLevel);
        });
        next.addEventListener('click', () => {
            const target = Math.min(3, currentLevel + 1);
            loadLevel(target);
        });
    }
    // Hide any extra buttons that may exist outside our container (avoid duplicate Play Again)
    const allButtons = winEl.querySelectorAll('button');
    allButtons.forEach((b) => {
        const isManaged = b.id === 'btn-replay' || b.id === 'btn-next' || b.parentElement?.id === 'win-actions';
        if (!isManaged) b.style.display = 'none';
    });
    // Show/Hide Next button based on current level
    const nextBtn = container.querySelector('#btn-next');
    if (nextBtn) nextBtn.style.display = currentLevel < 3 ? 'inline-block' : 'none';
}

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
        // Score already reflects coins collected; just ensure UI and high score update
        if (scoreEl) scoreEl.textContent = `Score: ${score}`;
        updateHighScoreIfNeeded();
        ensureWinOptions();
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
            coinsCollected += 1;
            score += 10;
            if (scoreEl) scoreEl.textContent = `Score: ${score}`;
            // High score updates only when goal is reached
            playBeep(880, 0.08);
        }
    }
}

function checkSpikes() {
    if (gameLost || gameWon || spikeCooldown > 0) return;
    for (const s of spikes) {
        const d = Math.hypot(marbleState.position.x - s.mesh.position.x, marbleState.position.z - s.mesh.position.z);
        if (d < marbleRadius + (s.radius || 0.23)) {
            // Spike penalty: reset to level spawn without ending the game
            playBeep(220, 0.06);
            resetToSpawnOnly();
            spikeCooldown = 0.7; // seconds of invulnerability after spike
            break;
        }
    }
}

// Physics update
function updatePhysics(deltaTime) {
    if (gameWon || gameLost || !gameStarted || isPaused) return;
    
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

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();

    // Only advance cooldowns, timer and physics when not paused
    if (!isPaused) {
        if (spikeCooldown > 0) spikeCooldown = Math.max(0, spikeCooldown - deltaTime);
    
        // Timer update
        if (gameStarted && !gameWon && !gameLost) {
            timeRemaining -= deltaTime;
            if (timeRemaining <= 0) {
                timeRemaining = 0;
                gameLost = true;
                if (loseEl) loseEl.style.display = 'block';
                ensureLoseOptions();
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
        
        // Update physics and obstacles
        updatePhysics(deltaTime);
        updateMovingObstacles(deltaTime);
        // Collectibles check
        if (gameStarted && !gameWon && !gameLost) {
            checkCoins();
            checkSpikes();
        }
    }

    // Update point light position to follow marble even when paused (keeps visuals consistent)
    pointLight.position.set(
        marbleState.position.x,
        marbleState.position.y + 3,
        marbleState.position.z
    );
    
    if (typeof goal !== 'undefined' && goal) {
        const t = clock.elapsedTime;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.0); // 2Hz pulsing in range 0..1

        // Prefer material.emissiveIntensity if available, otherwise modulate emissive color
        if ('emissiveIntensity' in goal.material) {
            goal.material.emissiveIntensity = 0.25 + 0.6 * pulse; // tweak range as needed
        } else {
            const base = new THREE.Color(0x27ae60);
            // scale the base emissive color by a factor
            const factor = 0.15 + 0.85 * pulse;
            goal.material.emissive.copy(base).multiplyScalar(factor);
        }
        goal.material.needsUpdate = true;

        // If you created a halo mesh and stored it on goal.userData.glow, pulse its opacity/scale too
        if (goal.userData && goal.userData.glow) {
            const g = goal.userData.glow;
            g.material.opacity = 0.06 + 0.2 * pulse;
            const s = 1.0 + 0.08 * pulse;
            g.scale.set(s, 1, s);
            g.position.copy(goal.position);
            g.material.needsUpdate = true;
        }
    }

    if (coins && coins.length) {
        const t = clock.elapsedTime;
        const amp = 0.08;   // bob amplitude in world units
        const freq = 0.5;   // bob frequency (Hz)
        for (const c of coins) {
            if (c.taken || !c.mesh) continue;
            const phase = c.phase || 0;
            c.mesh.position.y = c.baseY + amp * Math.sin(t * Math.PI * 2 * freq + phase);
        }
    }

    if (spikes && spikes.length) {
        const tt = clock.elapsedTime;
        for (const s of spikes) {
            const m = s.mesh;
            if (!m) continue;
            const ud = m.userData || {};
            const phase = ud.phase || 0;
            const wobAmp = ud.wobbleAmp || 0.001;
            const freq = ud.wobbleFreq || 1;
            const tilt = ud.wobbleTilt || 0.05;

            // vertical bob (doesn't affect collision logic which uses x/z)
            m.position.y = (ud.baseY ?? m.position.y) + wobAmp * Math.sin(tt * Math.PI * 2 * freq + phase);

            // gentle rocking/tilt for a vibrating look
            m.rotation.x = tilt * Math.sin(tt * Math.PI * 2 * freq * 1.05 + phase * 1.3);
            m.rotation.z = tilt * Math.cos(tt * Math.PI * 2 * freq * 0.95 + phase * 0.7);
        }
    }

    // (Follow camera removed)

    // Update controls if enabled
    if (controls.enabled) {
        controls.update();
    }
    
    renderer.render(scene, camera);
}

animate();

// Confetti removed: keep no-op hooks to avoid runtime errors
function spawnConfetti(_pos) { /* no-op */ }
function clearConfetti() { /* no-op */ }
