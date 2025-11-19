// 3D Rubik's Cube logic with mouse + keyboard controls

const CUBE_SIZE = 1;
const SPACING = 0.02;
const ANIMATION_SPEED_SHUFFLE = 100;
const ANIMATION_SPEED_SOLVE = 150;
const ANIMATION_SPEED_MANUAL = 250;

const COLORS = [
    0xb90000,
    0xff5900,
    0xffffff,
    0xffd500,
    0x009b48,
    0x0045ad
];
const COLOR_BLACK = 0x222222;

const KEY_MOVES = {
    r: { axis: 'x', index: 1, dir: 1 },
    l: { axis: 'x', index: -1, dir: -1 },
    u: { axis: 'y', index: 1, dir: 1 },
    d: { axis: 'y', index: -1, dir: -1 },
    f: { axis: 'z', index: 1, dir: 1 },
    b: { axis: 'z', index: -1, dir: -1 }
};

let scene, camera, renderer, controls;
let pivot;
let raycaster, mouse;
let allCubies = [];
let isAnimating = false;

let isDraggingCube = false;
let startMousePos = { x: 0, y: 0 };
let intersectedCubie = null;
let intersectedFaceNormal = null;
const dragThreshold = 10;

let moveQueue = [];
let moveHistory = [];

const tempQuaternion = new THREE.Quaternion();

function init() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111014);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(6, 5, 8);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 20;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-10, -10, -10);
    scene.add(backLight);

    pivot = new THREE.Object3D();
    pivot.rotation.order = 'XYZ';
    scene.add(pivot);

    createRubiksCube();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    document.getElementById('btn-shuffle').addEventListener('click', startShuffle);
    document.getElementById('btn-solve').addEventListener('click', startSolve);

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onMouseUp);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onMouseUp);
    window.addEventListener('touchcancel', onMouseUp);

    updateStatus('Status: Ready');
    requestAnimationFrame(animate);
}

function createRubiksCube() {
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const materials = [];
                materials.push(getFaceMaterial(x === 1 ? COLORS[0] : COLOR_BLACK));
                materials.push(getFaceMaterial(x === -1 ? COLORS[1] : COLOR_BLACK));
                materials.push(getFaceMaterial(y === 1 ? COLORS[2] : COLOR_BLACK));
                materials.push(getFaceMaterial(y === -1 ? COLORS[3] : COLOR_BLACK));
                materials.push(getFaceMaterial(z === 1 ? COLORS[4] : COLOR_BLACK));
                materials.push(getFaceMaterial(z === -1 ? COLORS[5] : COLOR_BLACK));

                const cubie = new THREE.Mesh(geometry, materials);
                cubie.position.set(
                    x * (CUBE_SIZE + SPACING),
                    y * (CUBE_SIZE + SPACING),
                    z * (CUBE_SIZE + SPACING)
                );
                cubie.userData = { isCubie: true };

                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
                cubie.add(line);

                scene.add(cubie);
                allCubies.push(cubie);
            }
        }
    }
}

function getFaceMaterial(color) {
    return new THREE.MeshPhongMaterial({ color, shininess: 10, flatShading: true });
}

function getIntersects(event, element) {
    const rect = element.getBoundingClientRect();
    let clientX = event.clientX;
    let clientY = event.clientY;

    if (event.changedTouches && event.changedTouches.length) {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
    }

    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(allCubies);
}

function onMouseDown(event) {
    if (isAnimating || moveQueue.length > 0) return;
    const intersects = getIntersects(event, renderer.domElement);
    if (!intersects.length) return;

    controls.enabled = false;
    isDraggingCube = true;
    intersectedCubie = intersects[0].object;
    intersectedCubie.getWorldQuaternion(tempQuaternion);
    intersectedFaceNormal = intersects[0].face.normal.clone().applyQuaternion(tempQuaternion).round();

    const clientX = event.clientX ?? (event.touches && event.touches[0].clientX);
    const clientY = event.clientY ?? (event.touches && event.touches[0].clientY);
    startMousePos = { x: clientX, y: clientY };
}

function onTouchStart(event) {
    event.preventDefault();
    onMouseDown(event);
}

function onMouseMove(event) {
    if (!isDraggingCube || !intersectedCubie) return;

    const clientX = event.clientX ?? (event.touches && event.touches[0].clientX);
    const clientY = event.clientY ?? (event.touches && event.touches[0].clientY);

    const dx = clientX - startMousePos.x;
    const dy = clientY - startMousePos.y;

    if (Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
        handleCubeDrag(dx, dy);
        resetDragState();
    }
}

function onTouchMove(event) {
    if (isDraggingCube) event.preventDefault();
    onMouseMove(event);
}

function onMouseUp() {
    resetDragState();
}

function resetDragState() {
    isDraggingCube = false;
    intersectedCubie = null;
    intersectedFaceNormal = null;
    controls.enabled = true;
}

function handleCubeDrag(dx, dy) {
    if (!intersectedFaceNormal || !intersectedCubie) return;

    const moveVector = new THREE.Vector2(dx, -dy).normalize();
    const axes = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1)
    ];

    let bestAxis = null;
    let maxDot = 0;
    let screenDirection = 1;

    axes.forEach(axis => {
        if (Math.abs(axis.dot(intersectedFaceNormal)) > 0.9) return;
        const axis2D = projectVectorToScreen(axis);
        const dot = axis2D.dot(moveVector);
        if (Math.abs(dot) > maxDot) {
            maxDot = Math.abs(dot);
            bestAxis = axis;
            screenDirection = dot > 0 ? 1 : -1;
        }
    });

    if (!bestAxis) return;

    const rotationVector = new THREE.Vector3().crossVectors(intersectedFaceNormal, bestAxis);
    let rotAxisLabel = '';
    if (Math.abs(rotationVector.x) > 0.9) rotAxisLabel = 'x';
    else if (Math.abs(rotationVector.y) > 0.9) rotAxisLabel = 'y';
    else rotAxisLabel = 'z';

    const unit = CUBE_SIZE + SPACING;
    const localPos = intersectedCubie.position.clone().divideScalar(unit).round();

    let rotDir = rotationVector[rotAxisLabel] > 0 ? 1 : -1;
    rotDir *= screenDirection;
    if (rotAxisLabel === 'x') rotDir *= -1;

    queueMove(rotAxisLabel, localPos[rotAxisLabel], rotDir, ANIMATION_SPEED_MANUAL);
}

function projectVectorToScreen(vector) {
    const center = new THREE.Vector3(0, 0, 0);
    const tip = vector.clone();
    center.project(camera);
    tip.project(camera);
    const result = new THREE.Vector2(tip.x - center.x, tip.y - center.y);
    if (result.lengthSq() === 0) return result;
    return result.normalize();
}

function queueMove(axis, index, dir, speed, isSolving = false) {
    moveQueue.push({ axis, index, dir, speed, isSolving });
    processQueue();
}

function processQueue() {
    if (isAnimating || moveQueue.length === 0) return;
    const move = moveQueue.shift();
    if (!move.isSolving) moveHistory.push(move);
    animateMove(move.axis, move.index, move.dir, move.speed || 300);
}

function animateMove(axis, index, dir, duration) {
    isAnimating = true;
    updateStatus('Status: Moving…');

    const activeCubies = [];
    const epsilon = 0.1;
    allCubies.forEach(cubie => {
        const pos = new THREE.Vector3();
        cubie.getWorldPosition(pos);
        const localPos = pos.divideScalar(CUBE_SIZE + SPACING);
        if (Math.abs(localPos[axis] - index) < epsilon) activeCubies.push(cubie);
    });

    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();
    activeCubies.forEach(cubie => pivot.attach(cubie));

    const targetRotation = (Math.PI / 2) * dir * -1;
    const startTime = performance.now();

    function loop(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        pivot.rotation[axis] = targetRotation * ease;

        if (progress < 1) {
            requestAnimationFrame(loop);
        } else {
            pivot.rotation[axis] = targetRotation;
            pivot.updateMatrixWorld();

            activeCubies.forEach(cubie => {
                scene.attach(cubie);
                const pos = cubie.position;
                const unit = CUBE_SIZE + SPACING;
                cubie.position.set(
                    Math.round(pos.x / unit) * unit,
                    Math.round(pos.y / unit) * unit,
                    Math.round(pos.z / unit) * unit
                );

                const euler = new THREE.Euler().setFromQuaternion(cubie.quaternion);
                cubie.rotation.set(
                    Math.round(euler.x / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(euler.y / (Math.PI / 2)) * (Math.PI / 2),
                    Math.round(euler.z / (Math.PI / 2)) * (Math.PI / 2)
                );
                cubie.updateMatrix();
            });

            isAnimating = false;
            updateStatus('Status: Ready');
            processQueue();
        }
    }

    requestAnimationFrame(loop);
}

function startShuffle() {
    if (isAnimating) return;
    const axes = ['x', 'y', 'z'];
    const indices = [-1, 0, 1];
    const dirs = [1, -1];
    const moves = 20;

    for (let i = 0; i < moves; i++) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const index = indices[Math.floor(Math.random() * indices.length)];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        queueMove(axis, index, dir, ANIMATION_SPEED_SHUFFLE);
    }

    const solveBtn = document.getElementById('btn-solve');
    if (solveBtn) solveBtn.disabled = false;
}

function startSolve() {
    if (moveHistory.length === 0) return;
    moveQueue = [];
    const reversedHistory = [...moveHistory].reverse();
    reversedHistory.forEach(move => {
        queueMove(move.axis, move.index, move.dir * -1, ANIMATION_SPEED_SOLVE, true);
    });
    moveHistory = [];
    const solveBtn = document.getElementById('btn-solve');
    if (solveBtn) solveBtn.disabled = true;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onKeyDown(event) {
    if (isAnimating || moveQueue.length > 0) return;
    const move = KEY_MOVES[event.key.toLowerCase()];
    if (!move) return;
    const dir = event.shiftKey ? -move.dir : move.dir;
    queueMove(move.axis, move.index, dir, ANIMATION_SPEED_MANUAL);
}

function updateStatus(text) {
    const status = document.getElementById('status');
    if (status) status.textContent = text;
}

init();
