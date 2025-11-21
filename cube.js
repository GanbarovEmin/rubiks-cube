// 3D Rubik's Cube logic with mouse + keyboard controls

const CUBE_SIZE = 1;
const SPACING = 0.02;
const ANIMATION_SPEED_SHUFFLE = 100;
const ANIMATION_SPEED_SOLVE = 150;
const MOVE_SPEEDS = {
    slow: 420,
    normal: 250,
    fast: 140
};
const LOCAL_STORAGE_KEYS = {
    controlMode: 'rubiks_controlMode_v1',
    moveSpeed: 'rubiks_moveSpeed_v1',
    soundEnabled: 'rubiks_sound_v1',
    theme: 'rubiks_theme_v1'
};
const SHUFFLE_MOVE_RANGES = {
    easy: [10, 15],
    medium: [20, 25],
    hard: [40, 45]
};

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
const GIZMO_MOVES = {
    r: { axis: 'x', index: 1, dir: 1 },
    "r'": { axis: 'x', index: 1, dir: -1 },
    l: { axis: 'x', index: -1, dir: -1 },
    "l'": { axis: 'x', index: -1, dir: 1 },
    u: { axis: 'y', index: 1, dir: 1 },
    "u'": { axis: 'y', index: 1, dir: -1 },
    d: { axis: 'y', index: -1, dir: -1 },
    "d'": { axis: 'y', index: -1, dir: 1 },
    f: { axis: 'z', index: 1, dir: 1 },
    "f'": { axis: 'z', index: 1, dir: -1 },
    b: { axis: 'z', index: -1, dir: -1 },
    "b'": { axis: 'z', index: -1, dir: 1 }
};

const KEYBOARD_DRAG_VECTORS = {
    w: new THREE.Vector2(0, 1),
    a: new THREE.Vector2(-1, 0),
    s: new THREE.Vector2(0, -1),
    d: new THREE.Vector2(1, 0)
};

let scene, camera, renderer, controls;
let pivot;
let raycaster, mouse;
let allCubies = [];
let isAnimating = false;
let animationToken = 0;
let isAutoSolving = false;

let isDraggingCube = false;
let dragMoveCommitted = false;
let startMousePos = { x: 0, y: 0 };
let intersectedCubie = null;
let intersectedFaceNormal = null;
const dragThreshold = 30;

let hoveredMaterial = null;
let hoveredEmissive = null;
let hoveredCubie = null;
let hoveredFaceNormal = null;

let moveQueue = [];
let moveHistory = [];
let moveCount = 0;
let hintOverlay = null;
let hintTimeout = null;
let shuffleDifficulty = 'medium';
let pendingShuffleMoves = 0;
let lastShuffleCount = 0;
let controlMode = 'drag';
let moveSpeed = 'normal';
let moveDuration = MOVE_SPEEDS[moveSpeed];
let soundEnabled = true;
let theme = 'light';
let audioContext = null;

let isTimerRunning = false;
let timerStartTime = 0;
let timerElapsed = 0;
let awaitingFirstMove = true;
let wasSolved = false;

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
    const resetButton = document.getElementById('btn-reset');
    if (resetButton) resetButton.addEventListener('click', resetCubeToSolved);
    const hintButton = document.getElementById('btn-hint');
    if (hintButton) hintButton.addEventListener('click', onHintRequest);
    const playAgainButton = document.getElementById('btn-play-again');
    if (playAgainButton) playAgainButton.addEventListener('click', onPlayAgain);

    const difficultySelect = document.getElementById('shuffle-difficulty');
    if (difficultySelect) {
        shuffleDifficulty = difficultySelect.value || shuffleDifficulty;
        updateShuffleRangeHelper(shuffleDifficulty);
        difficultySelect.addEventListener('change', event => {
            shuffleDifficulty = event.target.value;
            updateShuffleRangeHelper(shuffleDifficulty);
            updateStatus(`Status: Difficulty set to ${formatDifficultyLabel(shuffleDifficulty)}`);
        });
    }

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onMouseUp);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onMouseUp);
    window.addEventListener('touchcancel', onMouseUp);

    updateStatus('Status: Ready');
    resetMoveCounter();
    resetTimer();
    initializeSettingsPanel();
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

function isPointerInteractionAllowed() {
    return controlMode === 'drag' && !isAnimating && moveQueue.length === 0 && !isAutoSolving;
}

function clearHoverHighlight() {
    if (hoveredMaterial && hoveredEmissive) {
        hoveredMaterial.emissive.copy(hoveredEmissive);
        hoveredMaterial.emissiveIntensity = 1;
    }
    hoveredMaterial = null;
    hoveredEmissive = null;
    hoveredCubie = null;
    hoveredFaceNormal = null;
}

function updateHoverHighlight(event) {
    const intersects = getIntersects(event, renderer.domElement);
    if (!intersects.length) {
        clearHoverHighlight();
        return;
    }

    const { object, face } = intersects[0];
    const materialIndex = face?.materialIndex ?? Math.floor((face?.faceIndex ?? 0) / 2);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const material = materials[materialIndex];
    const faceNormal = face?.normal
        ?.clone()
        ?.applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()))
        ?.round();

    if (!material || material === hoveredMaterial) return;
    if (material.color.getHex() === COLOR_BLACK) {
        clearHoverHighlight();
        return;
    }

    clearHoverHighlight();
    hoveredMaterial = material;
    hoveredEmissive = material.emissive.clone();
    hoveredCubie = object;
    hoveredFaceNormal = faceNormal;
    material.emissive.setHex(0x222222);
    material.emissiveIntensity = 0.6;
}

function onMouseDown(event) {
    if (!isPointerInteractionAllowed()) return;
    if (event.button !== undefined && event.button !== 0) return;
    const intersects = getIntersects(event, renderer.domElement);
    if (!intersects.length) return;

    controls.enabled = false;
    isDraggingCube = true;
    dragMoveCommitted = false;
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
    if (isDraggingCube && intersectedCubie) {
        if (!isPointerInteractionAllowed() || dragMoveCommitted) return;
        const clientX = event.clientX ?? (event.touches && event.touches[0].clientX);
        const clientY = event.clientY ?? (event.touches && event.touches[0].clientY);

        const dx = clientX - startMousePos.x;
        const dy = clientY - startMousePos.y;

        handleCubeDrag(dx, dy);
        return;
    }

    if (!isPointerInteractionAllowed()) {
        clearHoverHighlight();
        return;
    }

    updateHoverHighlight(event);
}

function onTouchMove(event) {
    if (isDraggingCube) event.preventDefault();
    onMouseMove(event);
}

function onMouseUp(event) {
    resetDragState();
    if (!event) return;
    if (isPointerInteractionAllowed()) {
        updateHoverHighlight(event);
    } else {
        clearHoverHighlight();
    }
}

function onMouseLeave() {
    clearHoverHighlight();
    resetDragState();
}

function resetDragState() {
    isDraggingCube = false;
    dragMoveCommitted = false;
    intersectedCubie = null;
    intersectedFaceNormal = null;
    controls.enabled = true;
}

function deriveMoveFromGesture(faceNormal, cubie, moveVector) {
    if (!faceNormal || !cubie) return null;
    if (!moveVector || moveVector.lengthSq() === 0) return null;

    const normalizedMove = moveVector.clone();
    if (normalizedMove.lengthSq() === 0) return null;
    normalizedMove.normalize();

    const axisLookup = [
        { label: 'x', vec: new THREE.Vector3(1, 0, 0) },
        { label: 'y', vec: new THREE.Vector3(0, 1, 0) },
        { label: 'z', vec: new THREE.Vector3(0, 0, 1) }
    ];

    let faceAxis = 'x';
    let maxNormalDot = 0;
    axisLookup.forEach(({ label, vec }) => {
        const dot = Math.abs(vec.dot(faceNormal));
        if (dot > maxNormalDot) {
            maxNormalDot = dot;
            faceAxis = label;
        }
    });

    const tangentAxes = axisLookup.filter(({ label }) => label !== faceAxis);
    let bestTangent = null;
    let maxDot = 0;
    let screenDirection = 1;

    tangentAxes.forEach(axis => {
        const axis2D = projectVectorToScreen(axis.vec);
        const dot = axis2D.dot(normalizedMove);
        if (Math.abs(dot) > maxDot) {
            maxDot = Math.abs(dot);
            bestTangent = axis;
            screenDirection = dot > 0 ? 1 : -1;
        }
    });

    if (!bestTangent) return;

    const unit = CUBE_SIZE + SPACING;
    const localPos = cubie.position.clone().divideScalar(unit).round();
    const faceNormalSign = Math.sign(faceNormal[faceAxis]) || 1;

    let rotDir = screenDirection * faceNormalSign;
    if (faceAxis === 'x') {
        rotDir *= bestTangent.label === 'y' ? 1 : -1;
    } else if (faceAxis === 'y') {
        rotDir *= bestTangent.label === 'z' ? 1 : -1;
    } else {
        rotDir *= bestTangent.label === 'x' ? 1 : -1;
    }

    return { axis: faceAxis, index: localPos[faceAxis], dir: rotDir };
}

function handleCubeDrag(dx, dy) {
    if (!intersectedFaceNormal || !intersectedCubie || dragMoveCommitted) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dominantDelta = Math.max(absX, absY);
    if (dominantDelta < dragThreshold) return;

    const isHorizontal = absX >= absY;
    const directionVector = isHorizontal
        ? new THREE.Vector2(Math.sign(dx) || 0, 0)
        : new THREE.Vector2(0, Math.sign(-dy) || 0);

    if (directionVector.lengthSq() === 0) return;

    const moveFromHover = deriveMoveFromGesture(intersectedFaceNormal, intersectedCubie, directionVector);
    if (moveFromHover) {
        dragMoveCommitted = true;
        queueMove(moveFromHover.axis, moveFromHover.index, moveFromHover.dir, moveDuration, {
            countsTowardsMoveCount: true
        });
    }
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
    const { isSolving = false, countsTowardsMoveCount = false, isShuffle = false } = options;
    if (countsTowardsMoveCount) {
        startTimerIfNeeded();
    }
    moveQueue.push({ axis, index, dir, speed, isSolving, countsTowardsMoveCount, isShuffle });
    processQueue();
}

function processQueue() {
    if (isAnimating) return;
    if (moveQueue.length === 0) {
        handleQueueIdle();
        return;
    }
    const move = moveQueue.shift();
    if (!move.isSolving) {
        recordMoveInHistory(move);
    }
    updateHintAvailability();
    animateMove(move);
}

function handleQueueIdle() {
    if (isAutoSolving) {
        isAutoSolving = false;
        updateStatus('Status: Ready');
    }
    updateHintAvailability();
}

function recordMoveInHistory(move) {
    const { axis, index, dir } = move;
    moveHistory.push({ axis, index, dir });
    if (moveHistory.length > 500) {
        moveHistory.shift();
    }
}

function animateMove(move) {
    const { axis, index, dir, speed, countsTowardsMoveCount, isShuffle = false, isSolving = false } = move;
    const duration = speed || 300;
    const token = ++animationToken;
    clearHoverHighlight();
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
        if (token !== animationToken) {
            pivot.rotation[axis] = targetRotation;
            pivot.updateMatrixWorld();
            activeCubies.forEach(cubie => scene.attach(cubie));
            isAnimating = false;
            return;
        }

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
            if (countsTowardsMoveCount || (!isShuffle && !isSolving)) {
                playMoveSound();
            }
            if (isShuffle && pendingShuffleMoves > 0) {
                pendingShuffleMoves -= 1;
            }
            isAnimating = false;
            if (isShuffle) {
                if (pendingShuffleMoves === 0) {
                    updateStatus(`Status: Shuffled (${formatDifficultyLabel(shuffleDifficulty)} • ${lastShuffleCount} moves)`);
                } else {
                    updateStatus(`Status: Shuffling (${pendingShuffleMoves} to go)`);
                }
            } else {
                updateStatus('Status: Ready');
            }
            updateHintAvailability();
            checkSolvedState();
            processQueue();
        }
    }

    requestAnimationFrame(loop);
}

function resetCubeToSolved() {
    animationToken++;
    isAnimating = false;
    isAutoSolving = false;
    moveQueue = [];
    moveHistory = [];
    clearHintOverlay();
    awaitingFirstMove = true;
    resetMoveCounter();
    resetTimer();
    updateStatus('Status: Ready');

    const solveBtn = document.getElementById('btn-solve');
    if (solveBtn) solveBtn.disabled = true;

    while (pivot.children.length) {
        scene.attach(pivot.children[0]);
    }

    const disposedGeometries = new Set();
    const disposedMaterials = new Set();

    allCubies.forEach(cubie => {
        scene.remove(cubie);

        const geometry = cubie.geometry;
        if (geometry && !disposedGeometries.has(geometry.uuid)) {
            geometry.dispose();
            disposedGeometries.add(geometry.uuid);
        }

        const materials = Array.isArray(cubie.material) ? cubie.material : [cubie.material];
        materials.forEach(material => {
            if (material && !disposedMaterials.has(material.uuid)) {
                material.dispose();
                disposedMaterials.add(material.uuid);
            }
        });
    });

    allCubies = [];
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();

    createRubiksCube();
    updateHintAvailability();
}

function startShuffle() {
    if (isAnimating || moveQueue.length > 0 || isAutoSolving) return;
    moveQueue = [];
    moveHistory = [];
    wasSolved = false;
    hideVictoryUI();
    clearHintOverlay();
    resetMoveCounter();
    resetTimer();
    moveHistory = [];
    updateStatus('Status: Shuffling…');
    const axes = ['x', 'y', 'z'];
    const indices = [-1, 0, 1];
    const dirs = [1, -1];
    const moves = getShuffleMoveCount();
    lastShuffleCount = moves;
    pendingShuffleMoves = moves;

    updateStatus(`Status: Shuffling (${formatDifficultyLabel(shuffleDifficulty)} • ${moves} moves)`);

    for (let i = 0; i < moves; i++) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const index = indices[Math.floor(Math.random() * indices.length)];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        queueMove(axis, index, dir, ANIMATION_SPEED_SHUFFLE, { isShuffle: true });
    }

    const solveBtn = document.getElementById('btn-solve');
    if (solveBtn) solveBtn.disabled = false;
    updateHintAvailability();
}

function getShuffleMoveCount() {
    const [min, max] = SHUFFLE_MOVE_RANGES[shuffleDifficulty] || SHUFFLE_MOVE_RANGES.medium;
    return randomInt(min, max);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDifficultyLabel(difficulty) {
    return `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1).toLowerCase()}`;
}

function updateShuffleRangeHelper(difficulty) {
    const helper = document.getElementById('shuffle-range-hint') || document.getElementById('shuffle-range');
    const [min, max] = SHUFFLE_MOVE_RANGES[difficulty] || SHUFFLE_MOVE_RANGES.medium;
    if (helper) helper.textContent = `${min}–${max} moves`;
}

function buildInverseSequence(history) {
    return [...history]
        .reverse()
        .map(move => ({ axis: move.axis, index: move.index, dir: move.dir * -1 }));
}

function startSolve() {
    if (isAnimating || moveQueue.length > 0 || moveHistory.length === 0 || isAutoSolving) return;

    const inverseMoves = buildInverseSequence(moveHistory);
    if (inverseMoves.length === 0) return;

    pendingShuffleMoves = 0;
    isAutoSolving = true;
    moveQueue = [];
    updateStatus('Status: Solving…');

    inverseMoves.forEach(move => {
        queueMove(move.axis, move.index, move.dir, ANIMATION_SPEED_SOLVE, { isSolving: true });
    });

    moveHistory = [];
    resetMoveCounter();
    clearHintOverlay();
    updateHintAvailability();
}

function initializeSettingsPanel() {
    loadSettingsFromStorage();
    applyTheme(theme, { persist: false });
    applyMoveSpeed(moveSpeed, { persist: false });
    applySoundSetting(soundEnabled, { persist: false });
    applyControlMode(controlMode, { persist: false });
    syncSettingsControls();

    const toggle = document.getElementById('settings-toggle');
    const backdrop = document.getElementById('settings-backdrop');
    const closeBtn = document.getElementById('settings-close');
    const panel = document.getElementById('settings-panel');

    if (toggle) toggle.addEventListener('click', () => toggleSettingsPanel());
    if (backdrop) backdrop.addEventListener('click', () => closeSettingsPanel());
    if (closeBtn) closeBtn.addEventListener('click', () => closeSettingsPanel());
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeSettingsPanel();
    });

    const controlSelect = document.getElementById('control-mode-select');
    if (controlSelect) {
        controlSelect.addEventListener('change', event => {
            applyControlMode(event.target.value);
        });
    }

    const speedSelect = document.getElementById('speed-select');
    if (speedSelect) {
        speedSelect.addEventListener('change', event => {
            applyMoveSpeed(event.target.value);
        });
    }

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('change', event => {
            applySoundSetting(event.target.checked);
        });
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', event => {
            applyTheme(event.target.value);
        });
    }

    if (panel) {
        panel.addEventListener('click', event => {
            event.stopPropagation();
        });
    }

    const gizmoButtons = document.querySelectorAll('#gizmo-controls button');
    gizmoButtons.forEach(button => {
        button.addEventListener('click', handleGizmoButtonClick);
    });
}

function handleGizmoButtonClick(event) {
    if (controlMode !== 'gizmo') return;
    const moveKey = event.currentTarget?.dataset?.move;
    const move = GIZMO_MOVES[moveKey];
    if (!move) return;
    if (isAnimating || moveQueue.length > 0 || isAutoSolving) return;
    queueMove(move.axis, move.index, move.dir, moveDuration, { countsTowardsMoveCount: true });
}

function toggleSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
        openSettingsPanel();
    } else {
        closeSettingsPanel();
    }
}

function openSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    const backdrop = document.getElementById('settings-backdrop');
    if (panel) panel.classList.remove('hidden');
    if (backdrop) backdrop.classList.remove('hidden');
}

function closeSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    const backdrop = document.getElementById('settings-backdrop');
    if (panel) panel.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
}

function syncSettingsControls() {
    const controlSelect = document.getElementById('control-mode-select');
    if (controlSelect) controlSelect.value = controlMode;
    const speedSelect = document.getElementById('speed-select');
    if (speedSelect) speedSelect.value = moveSpeed;
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) soundToggle.checked = soundEnabled;
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = theme;
}

function applyControlMode(mode, { persist = true } = {}) {
    controlMode = mode === 'gizmo' ? 'gizmo' : 'drag';
    if (persist) persistSetting(LOCAL_STORAGE_KEYS.controlMode, controlMode);
    toggleGizmoControls(controlMode === 'gizmo');
    if (controlMode === 'gizmo') {
        clearHoverHighlight();
        resetDragState();
    }
    syncSettingsControls();
}

function applyMoveSpeed(speed, { persist = true } = {}) {
    moveSpeed = MOVE_SPEEDS[speed] ? speed : 'normal';
    moveDuration = MOVE_SPEEDS[moveSpeed];
    if (persist) persistSetting(LOCAL_STORAGE_KEYS.moveSpeed, moveSpeed);
    syncSettingsControls();
}

function applySoundSetting(enabled, { persist = true } = {}) {
    soundEnabled = Boolean(enabled);
    if (persist) persistSetting(LOCAL_STORAGE_KEYS.soundEnabled, soundEnabled);
    syncSettingsControls();
}

function applyTheme(nextTheme, { persist = true } = {}) {
    theme = nextTheme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark', theme === 'dark');
    if (persist) persistSetting(LOCAL_STORAGE_KEYS.theme, theme);
    syncSettingsControls();
}

function toggleGizmoControls(show) {
    const gizmoPanel = document.getElementById('gizmo-controls');
    if (!gizmoPanel) return;
    gizmoPanel.classList.toggle('hidden', !show);
}

function persistSetting(key, value) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
        }
    } catch (err) {
        console.warn('Could not persist setting', key, err);
    }
}

function loadSettingsFromStorage() {
    try {
        if (typeof localStorage === 'undefined') return;
        const storedControlMode = localStorage.getItem(LOCAL_STORAGE_KEYS.controlMode);
        if (storedControlMode === 'drag' || storedControlMode === 'gizmo') controlMode = storedControlMode;
        const storedSpeed = localStorage.getItem(LOCAL_STORAGE_KEYS.moveSpeed);
        if (storedSpeed && MOVE_SPEEDS[storedSpeed]) moveSpeed = storedSpeed;
        moveDuration = MOVE_SPEEDS[moveSpeed];
        const storedSound = localStorage.getItem(LOCAL_STORAGE_KEYS.soundEnabled);
        if (storedSound !== null) soundEnabled = storedSound === 'true';
        const storedTheme = localStorage.getItem(LOCAL_STORAGE_KEYS.theme);
        if (storedTheme === 'light' || storedTheme === 'dark') theme = storedTheme;
    } catch (err) {
        console.warn('Could not load settings from storage', err);
    }
}

function getAudioContext() {
    if (!audioContext) {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        audioContext = AudioContextConstructor ? new AudioContextConstructor() : null;
    }
    return audioContext;
}

function playMoveSound() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(520, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.18);
}

function onPlayAgain() {
    hideVictoryUI();
    wasSolved = false;
    startShuffle();
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
    if (isAnimating || moveQueue.length > 0 || isAutoSolving) return;

    const key = event.key.toLowerCase();
    const dragVector = KEYBOARD_DRAG_VECTORS[key];
    if (dragVector && hoveredCubie && hoveredFaceNormal) {
        const moveFromHover = deriveMoveFromGesture(hoveredFaceNormal, hoveredCubie, dragVector);
        if (moveFromHover) {
            queueMove(moveFromHover.axis, moveFromHover.index, moveFromHover.dir, moveDuration, {
                countsTowardsMoveCount: true
            });
        }
        return;
    }

    const move = KEY_MOVES[key];
    if (!move) return;
    const dir = event.shiftKey ? -move.dir : move.dir;
    queueMove(move.axis, move.index, dir, moveDuration, { countsTowardsMoveCount: true });
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

function showVictoryUI(finalTimeMs, finalMoves) {
    const overlay = document.getElementById('victory-overlay');
    const timeDisplay = document.getElementById('victory-time');
    const moveDisplay = document.getElementById('victory-moves');

    if (timeDisplay) timeDisplay.textContent = formatTime(finalTimeMs);
    if (moveDisplay) moveDisplay.textContent = finalMoves;
    if (overlay) overlay.classList.remove('hidden');
}

function hideVictoryUI() {
    const overlay = document.getElementById('victory-overlay');
    if (overlay) overlay.classList.add('hidden');
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
    const shuffleBtn = document.getElementById('btn-shuffle');
    const canInteract = !isAnimating && moveQueue.length === 0 && !isAutoSolving;
    const hasHistory = moveHistory.length > 0;

    if (hintBtn) {
        hintBtn.disabled = !(canInteract && hasHistory);
    }

    if (solveBtn) {
        solveBtn.disabled = !hasHistory || !canInteract;
    }

    if (shuffleBtn) {
        shuffleBtn.disabled = !canInteract;
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

function isCubeSolved() {
    const faceNormals = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ];

    const unit = CUBE_SIZE + SPACING;
    const epsilon = 0.1;
    const faces = [
        { axis: 'x', sign: 1 },
        { axis: 'x', sign: -1 },
        { axis: 'y', sign: 1 },
        { axis: 'y', sign: -1 },
        { axis: 'z', sign: 1 },
        { axis: 'z', sign: -1 }
    ];

    function getStickerColorForFace(cubie, targetAxis, targetSign) {
        const quaternion = cubie.getWorldQuaternion(new THREE.Quaternion());
        const materials = Array.isArray(cubie.material) ? cubie.material : [cubie.material];

        for (let i = 0; i < faceNormals.length; i++) {
            const material = materials[i];
            if (!material || material.color.getHex() === COLOR_BLACK) continue;

            const worldNormal = faceNormals[i].clone().applyQuaternion(quaternion);
            const { axis, sign } = dominantAxis(worldNormal);
            if (axis === targetAxis && sign === targetSign) {
                return material.color.getHex();
            }
        }

        return null;
    }

    return faces.every(face => {
        const faceColors = [];
        const target = face.sign * unit;

        allCubies.forEach(cubie => {
            const position = cubie.getWorldPosition(new THREE.Vector3());
            if (Math.abs(position[face.axis] - target) < epsilon) {
                const color = getStickerColorForFace(cubie, face.axis, face.sign);
                if (color !== null) faceColors.push(color);
            }
        });

        if (faceColors.length !== 9) return false;
        const reference = faceColors[0];
        if (reference === COLOR_BLACK) return false;
        return faceColors.every(color => color === reference);
    });
}

function checkSolvedState() {
    const solvedNow = isCubeSolved();

    if (!wasSolved && solvedNow) {
        stopTimer();
        awaitingFirstMove = false;
        updateStatus('Status: Solved!');
        showVictoryUI(timerElapsed, moveCount);
    } else if (wasSolved && !solvedNow) {
        hideVictoryUI();
    }

    wasSolved = solvedNow;
}

init();
