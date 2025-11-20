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
let moveCount = 0;
let hintOverlay = null;
let hintTimeout = null;

let isTimerRunning = false;
let timerStartTime = 0;
let timerElapsed = 0;
let awaitingFirstMove = true;

const tempQuaternion = new THREE.Quaternion();

function init() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = null;

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(6, 5, 8);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
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
    const hintButton = document.getElementById('btn-hint');
    if (hintButton) hintButton.addEventListener('click', onHintRequest);

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
    resetMoveCounter();
    resetTimer();
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

    queueMove(rotAxisLabel, localPos[rotAxisLabel], rotDir, ANIMATION_SPEED_MANUAL, { countsTowardsMoveCount: true });
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

function queueMove(axis, index, dir, speed, options = {}) {
    const { isSolving = false, countsTowardsMoveCount = false } = options;
    if (countsTowardsMoveCount) {
        startTimerIfNeeded();
    }
    moveQueue.push({ axis, index, dir, speed, isSolving, countsTowardsMoveCount });
    processQueue();
}

function processQueue() {
    if (isAnimating || moveQueue.length === 0) return;
    const move = moveQueue.shift();
    if (!move.isSolving) {
        recordMoveInHistory(move);
    }
    updateHintAvailability();
    animateMove(move);
}

function recordMoveInHistory(move) {
    const { axis, index, dir } = move;
    moveHistory.push({ axis, index, dir });
    if (moveHistory.length > 500) {
        moveHistory.shift();
    }
}

function animateMove(move) {
    const { axis, index, dir, speed, countsTowardsMoveCount } = move;
    const duration = speed || 300;
    isAnimating = true;
    updateStatus('Status: Moving…');
    updateHintAvailability();

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

            if (countsTowardsMoveCount) {
                incrementMoveCounter();
            }
            isAnimating = false;
            updateStatus('Status: Ready');
            updateHintAvailability();
            checkSolvedState();
            processQueue();
        }
    }

    requestAnimationFrame(loop);
}

function startShuffle() {
    if (isAnimating) return;
    resetMoveCounter();
    resetTimer();
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
    updateHintAvailability();
}

function startSolve() {
    if (moveHistory.length === 0) return;
    moveQueue = [];
    const reversedHistory = [...moveHistory].reverse();
    reversedHistory.forEach(move => {
        queueMove(move.axis, move.index, move.dir * -1, ANIMATION_SPEED_SOLVE, { isSolving: true });
    });
    moveHistory = [];
    resetMoveCounter();
    const solveBtn = document.getElementById('btn-solve');
    if (solveBtn) solveBtn.disabled = true;
    clearHintOverlay();
    updateHintAvailability();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    tickTimer();
    renderer.render(scene, camera);
}

function onKeyDown(event) {
    if (isAnimating || moveQueue.length > 0) return;
    const move = KEY_MOVES[event.key.toLowerCase()];
    if (!move) return;
    const dir = event.shiftKey ? -move.dir : move.dir;
    queueMove(move.axis, move.index, dir, ANIMATION_SPEED_MANUAL, { countsTowardsMoveCount: true });
}

function onHintRequest() {
    if (isAnimating || moveQueue.length > 0) return;
    if (moveHistory.length === 0) {
        updateStatus('Hint: Куб уже собран — подсказка не требуется.');
        clearHintOverlay();
        return;
    }

    const lastMove = moveHistory[moveHistory.length - 1];
    const suggestedMove = {
        axis: lastMove.axis,
        index: lastMove.index,
        dir: lastMove.dir * -1
    };

    showHintOverlay(suggestedMove.axis, suggestedMove.index);
    updateStatus(`Hint: ${describeHintMove(suggestedMove)}`);
}

function describeHintMove({ axis, index, dir }) {
    const axisNames = { x: 'X', y: 'Y', z: 'Z' };
    const layerNames = {
        x: { 1: 'Right', 0: 'Middle', [-1]: 'Left' },
        y: { 1: 'Up', 0: 'Middle', [-1]: 'Down' },
        z: { 1: 'Front', 0: 'Middle', [-1]: 'Back' }
    };

    const directionText = dir > 0 ? 'по часовой стрелке' : 'против часовой стрелки';
    const layerLabel = layerNames[axis]?.[index] ?? 'Layer';
    return `${layerLabel} (${axisNames[axis]}) — ${directionText}`;
}

function updateStatus(text) {
    const status = document.getElementById('status');
    if (status) status.textContent = text;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    const hundredths = Math.floor((ms % 1000) / 10)
        .toString()
        .padStart(2, '0');
    return `${minutes}:${seconds}.${hundredths}`;
}

function updateTimerDisplay(ms) {
    const timer = document.getElementById('timer');
    if (timer) timer.textContent = `Time: ${formatTime(ms)}`;
}

function resetTimer() {
    isTimerRunning = false;
    timerElapsed = 0;
    timerStartTime = 0;
    awaitingFirstMove = true;
    updateTimerDisplay(0);
}

function startTimerIfNeeded() {
    if (!awaitingFirstMove || isTimerRunning) return;
    timerStartTime = performance.now();
    isTimerRunning = true;
    awaitingFirstMove = false;
}

function stopTimer() {
    if (!isTimerRunning) return;
    timerElapsed = performance.now() - timerStartTime;
    isTimerRunning = false;
    updateTimerDisplay(timerElapsed);
}

function tickTimer() {
    if (isTimerRunning) {
        const current = performance.now();
        updateTimerDisplay(current - timerStartTime);
    }
}

function updateMoveCounter() {
    const moveDisplay = document.getElementById('move-counter');
    if (moveDisplay) moveDisplay.textContent = `Moves: ${moveCount}`;
}

function resetMoveCounter() {
    moveCount = 0;
    updateMoveCounter();
}

function incrementMoveCounter() {
    moveCount += 1;
    updateMoveCounter();
}

function updateHintAvailability() {
    const hintBtn = document.getElementById('btn-hint');
    const solveBtn = document.getElementById('btn-solve');
    const canInteract = !isAnimating && moveQueue.length === 0;
    const hasHistory = moveHistory.length > 0;

    if (hintBtn) {
        hintBtn.disabled = !(canInteract && hasHistory);
    }

    if (solveBtn) {
        solveBtn.disabled = !hasHistory || !canInteract;
    }
}

function showHintOverlay(axis, index) {
    clearHintOverlay();

    const unit = CUBE_SIZE + SPACING;
    const size = unit * 3;
    const material = new THREE.MeshBasicMaterial({
        color: 0xffa500,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const geometry = new THREE.PlaneGeometry(size, size);
    hintOverlay = new THREE.Mesh(geometry, material);

    if (axis === 'x') {
        hintOverlay.rotation.y = Math.PI / 2;
        hintOverlay.position.set(index * unit, 0, 0);
    } else if (axis === 'y') {
        hintOverlay.rotation.x = -Math.PI / 2;
        hintOverlay.position.set(0, index * unit, 0);
    } else {
        hintOverlay.position.set(0, 0, index * unit);
    }

    scene.add(hintOverlay);

    hintTimeout = setTimeout(() => {
        clearHintOverlay();
    }, 1800);
}

function clearHintOverlay() {
    if (hintTimeout) {
        clearTimeout(hintTimeout);
        hintTimeout = null;
    }

    if (hintOverlay) {
        scene.remove(hintOverlay);
        hintOverlay.geometry.dispose();
        hintOverlay.material.dispose();
        hintOverlay = null;
    }
}

function dominantAxis(normal) {
    const axes = ['x', 'y', 'z'];
    let dominant = 'x';
    let max = Math.abs(normal.x);
    axes.slice(1).forEach(axis => {
        if (Math.abs(normal[axis]) > max) {
            dominant = axis;
            max = Math.abs(normal[axis]);
        }
    });
    return { axis: dominant, sign: Math.sign(normal[dominant]) };
}

function expectedColorForOrientation(axis, sign) {
    if (axis === 'x') return sign > 0 ? COLORS[0] : COLORS[1];
    if (axis === 'y') return sign > 0 ? COLORS[2] : COLORS[3];
    return sign > 0 ? COLORS[4] : COLORS[5];
}

function isCubeSolved() {
    const faceNormals = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ];

    return allCubies.every(cubie => {
        const quaternion = cubie.getWorldQuaternion(new THREE.Quaternion());
        const materials = Array.isArray(cubie.material) ? cubie.material : [cubie.material];

        for (let i = 0; i < faceNormals.length; i++) {
            const material = materials[i];
            if (!material || material.color.getHex() === COLOR_BLACK) continue;

            const worldNormal = faceNormals[i].clone().applyQuaternion(quaternion);
            const { axis, sign } = dominantAxis(worldNormal);
            const expectedColor = expectedColorForOrientation(axis, sign);
            if (material.color.getHex() !== expectedColor) return false;
        }

        return true;
    });
}

function checkSolvedState() {
    if (isCubeSolved()) {
        updateStatus('Status: Solved!');
        stopTimer();
        awaitingFirstMove = false;
    }
}

init();
