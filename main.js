import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
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
    color: 0x2c3e50,
    shininess: 30
});
const platform = new THREE.Mesh(platformGeometry, platformMaterial);
platform.position.y = -0.25;
platform.receiveShadow = true;
platformGroup.add(platform);

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
        shininess: 30
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
    shininess: 30
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
walls.forEach(wall => {
    const geometry = new THREE.BoxGeometry(...wall.size);
    const mesh = new THREE.Mesh(geometry, wallMaterial);
    mesh.position.set(...wall.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    platformGroup.add(mesh);
    wallMeshes.push({
        mesh: mesh,
        box: new THREE.Box3().setFromObject(mesh)
    });
});

// Goal hole (cylinder)
const goalRadius = 0.6;
const goalGeometry = new THREE.CylinderGeometry(goalRadius, goalRadius, 0.1, 32);
const goalMaterial = new THREE.MeshPhongMaterial({
    color: 0x27ae60,
    emissive: 0x27ae60,
    emissiveIntensity: 0.3,
    shininess: 100
});
const goal = new THREE.Mesh(goalGeometry, goalMaterial);
goal.position.set(3.5, 0.05, 3.5);
goal.rotation.x = Math.PI / 2;
goal.receiveShadow = true;
platformGroup.add(goal);

// Marble
const marbleRadius = 0.3;
const marbleGeometry = new THREE.SphereGeometry(marbleRadius, 32, 32);
const marbleMaterial = new THREE.MeshPhongMaterial({
    color: 0xe74c3c,
    shininess: 100,
    specular: 0xffffff,
    reflectivity: 0.8
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
let currentCameraView = 3; // Start with angled view

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
    document.getElementById('win-message').style.display = 'none';
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

// Improved collision detection
function checkWallCollisions() {
    wallMeshes.forEach(wall => {
        // Update wall bounding box based on current platform rotation
        wall.box.setFromObject(wall.mesh);
        
        // Get wall bounds
        const wallMin = wall.box.min;
        const wallMax = wall.box.max;
        
        // Find closest point on wall box to marble center
        const closestPoint = new THREE.Vector3(
            Math.max(wallMin.x, Math.min(marbleState.position.x, wallMax.x)),
            Math.max(wallMin.y, Math.min(marbleState.position.y, wallMax.y)),
            Math.max(wallMin.z, Math.min(marbleState.position.z, wallMax.z))
        );
        
        // Calculate distance from marble center to closest point
        const distance = marbleState.position.distanceTo(closestPoint);
        
        // Check if marble is colliding with wall
        if (distance < marbleRadius) {
            // Calculate collision normal
            const collisionNormal = new THREE.Vector3()
                .subVectors(marbleState.position, closestPoint)
                .normalize();
            
            // If normal is zero (marble center inside wall), use position-based normal
            if (collisionNormal.length() < 0.001) {
                const wallCenter = new THREE.Vector3();
                wall.box.getCenter(wallCenter);
                collisionNormal.subVectors(marbleState.position, wallCenter).normalize();
            }
            
            // Push marble out of wall with extra margin
            const penetrationDepth = marbleRadius - distance;
            marbleState.position.add(
                collisionNormal.multiplyScalar(penetrationDepth + 0.01)
            );
            
            // Reflect velocity along collision normal
            const velocityAlongNormal = marbleState.velocity.dot(collisionNormal);
            
            // Only reflect if moving into the wall
            if (velocityAlongNormal < 0) {
                marbleState.velocity.sub(
                    collisionNormal.multiplyScalar(velocityAlongNormal * (1 + BOUNCE_DAMPING))
                );
            }
        }
    });
    
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
        document.getElementById('win-message').style.display = 'block';
    }
}

// Physics update
function updatePhysics(deltaTime) {
    if (gameWon) return;
    
    // Clamp delta time to prevent large jumps
    deltaTime = Math.min(deltaTime, 0.1);
    
    // Get platform rotation in world space
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationFromEuler(platformGroup.rotation);
    
    // Calculate gravity direction based on platform tilt
    const gravityDir = new THREE.Vector3(0, -1, 0);
    gravityDir.applyMatrix4(rotationMatrix);
    
    // Apply gravity force (project onto platform)
    // Note: gravityDir points down, so we need to negate to get the force direction
    const gravityForce = new THREE.Vector3(
        -gravityDir.x * GRAVITY,
        0,
        -gravityDir.z * GRAVITY
    );
    
    // Update velocity
    marbleState.velocity.add(gravityForce.multiplyScalar(deltaTime));
    
    // Apply friction
    marbleState.velocity.multiplyScalar(FRICTION);
    
    // Update position
    marbleState.position.add(
        marbleState.velocity.clone().multiplyScalar(deltaTime)
    );
    
    // Keep marble on platform (Y constraint)
    marbleState.position.y = marbleRadius;
    
    // Check collisions
    checkWallCollisions();
    
    // Check win condition
    checkWinCondition();
    
    // Update marble mesh position
    marble.position.copy(marbleState.position);
    
    // Update marble rotation (rolling)
    const speed = marbleState.velocity.length();
    if (speed > 0.01) {
        const axis = new THREE.Vector3(-marbleState.velocity.z, 0, marbleState.velocity.x).normalize();
        const angle = speed * deltaTime / marbleRadius;
        marble.rotateOnWorldAxis(axis, angle);
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    
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
