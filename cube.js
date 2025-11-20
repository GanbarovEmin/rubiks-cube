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

let moveCount = 0;

class CubeApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.pivot = null;
        this.raycaster = null;
        this.mouse = null;
        this.allCubies = [];

        this.isAnimating = false;
        this.hintOverlay = null;

        this.isDraggingCube = false;
        this.startMousePos = { x: 0, y: 0 };
        this.intersectedCubie = null;
        this.intersectedFaceNormal = null;
        this.dragThreshold = 10;

        this.moveQueue = [];
        this.moveHistory = [];
        this.tempQuaternion = new THREE.Quaternion();

        this.statusEl = document.getElementById('status');
        this.moveCounterEl = document.getElementById('move-counter');
        this.solveBtn = document.getElementById('btn-solve');
        this.shuffleBtn = document.getElementById('btn-shuffle');
        this.resetBtn = document.getElementById('btn-reset');
        this.hintBtn = document.getElementById('btn-hint');

        this.init();
    }

    init() {
        this.createScene();
        this.createLights();
        this.createControls();
        this.createRubiksCube();
        this.registerEventListeners();

        this.updateStatus('Status: Ready');
        this.resetMoveCounter();

        requestAnimationFrame(this.animate.bind(this));
    }

    createScene() {
        const container = document.getElementById('canvas-container');

        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(6, 5, 8);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0);
        container.appendChild(this.renderer.domElement);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.pivot = new THREE.Object3D();
        this.pivot.rotation.order = 'XYZ';
        this.scene.add(this.pivot);
    }

    createLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
        backLight.position.set(-10, -10, -10);
        this.scene.add(backLight);
    }

    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enablePan = false;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 4;
        this.controls.maxDistance = 20;
    }

    createRubiksCube() {
        const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const materials = [];
                    materials.push(this.getFaceMaterial(x === 1 ? COLORS[0] : COLOR_BLACK));
                    materials.push(this.getFaceMaterial(x === -1 ? COLORS[1] : COLOR_BLACK));
                    materials.push(this.getFaceMaterial(y === 1 ? COLORS[2] : COLOR_BLACK));
                    materials.push(this.getFaceMaterial(y === -1 ? COLORS[3] : COLOR_BLACK));
                    materials.push(this.getFaceMaterial(z === 1 ? COLORS[4] : COLOR_BLACK));
                    materials.push(this.getFaceMaterial(z === -1 ? COLORS[5] : COLOR_BLACK));

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

                    this.scene.add(cubie);
                    this.allCubies.push(cubie);
                }
            }
        }
    }

    getFaceMaterial(color) {
        return new THREE.MeshPhongMaterial({ color, shininess: 10, flatShading: true });
    }

    registerEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));

        this.shuffleBtn?.addEventListener('click', this.startShuffle.bind(this));
        this.solveBtn?.addEventListener('click', this.startSolve.bind(this));
        this.resetBtn?.addEventListener('click', this.resetCube.bind(this));
        this.hintBtn?.addEventListener('click', this.onHintRequest.bind(this));

        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
        canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
        canvas.addEventListener('mouseup', this.onPointerUp.bind(this));
        canvas.addEventListener('mouseleave', this.onPointerUp.bind(this));
        canvas.addEventListener('touchstart', this.onPointerDown.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.onPointerMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.onPointerUp.bind(this));

        window.addEventListener('mouseup', this.onPointerUp.bind(this));
        window.addEventListener('touchend', this.onPointerUp.bind(this));
        window.addEventListener('touchcancel', this.onPointerUp.bind(this));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onPointerDown(event) {
        if (this.isAnimating || this.moveQueue.length > 0) return;
        const intersects = this.getIntersects(event, this.renderer.domElement);
        if (!intersects.length) return;

        this.controls.enabled = false;
        this.isDraggingCube = true;
        this.intersectedCubie = intersects[0].object;
        this.intersectedCubie.getWorldQuaternion(this.tempQuaternion);
        this.intersectedFaceNormal = intersects[0].face.normal.clone().applyQuaternion(this.tempQuaternion).round();

        const { clientX, clientY } = this.getEventPosition(event);
        this.startMousePos = { x: clientX, y: clientY };
    }

    onPointerMove(event) {
        if (!this.isDraggingCube || !this.intersectedCubie) return;
        if (this.isTouchEvent(event)) event.preventDefault();

        const { clientX, clientY } = this.getEventPosition(event);
        const dx = clientX - this.startMousePos.x;
        const dy = clientY - this.startMousePos.y;

        if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
            this.handleCubeDrag(dx, dy);
            this.resetDragState();
        }
    }

    onPointerUp() {
        this.resetDragState();
    }

    resetDragState() {
        this.isDraggingCube = false;
        this.intersectedCubie = null;
        this.intersectedFaceNormal = null;
        this.controls.enabled = true;
    }

    getEventPosition(event) {
        if (event.changedTouches && event.changedTouches.length) {
            return { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY };
        }
        return { clientX: event.clientX, clientY: event.clientY };
    }

    isTouchEvent(event) {
        return event.changedTouches && event.changedTouches.length;
    }

    getIntersects(event, element) {
        const rect = element.getBoundingClientRect();
        const { clientX, clientY } = this.getEventPosition(event);

        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        return this.raycaster.intersectObjects(this.allCubies);
    }

    handleCubeDrag(dx, dy) {
        if (!this.intersectedFaceNormal || !this.intersectedCubie) return;

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
            if (Math.abs(axis.dot(this.intersectedFaceNormal)) > 0.9) return;
            const axis2D = this.projectVectorToScreen(axis);
            const dot = axis2D.dot(moveVector);
            if (Math.abs(dot) > maxDot) {
                maxDot = Math.abs(dot);
                bestAxis = axis;
                screenDirection = dot > 0 ? 1 : -1;
            }
        });

        if (!bestAxis) return;

        const rotationVector = new THREE.Vector3().crossVectors(this.intersectedFaceNormal, bestAxis);
        let rotAxisLabel = '';
        if (Math.abs(rotationVector.x) > 0.9) rotAxisLabel = 'x';
        else if (Math.abs(rotationVector.y) > 0.9) rotAxisLabel = 'y';
        else rotAxisLabel = 'z';

        const unit = CUBE_SIZE + SPACING;
        const localPos = this.intersectedCubie.position.clone().divideScalar(unit).round();

        let rotDir = rotationVector[rotAxisLabel] > 0 ? 1 : -1;
        rotDir *= screenDirection;
        if (rotAxisLabel === 'x') rotDir *= -1;

        this.queueMove(rotAxisLabel, localPos[rotAxisLabel], rotDir, ANIMATION_SPEED_MANUAL, { countsTowardsMoveCount: true });
    }

    projectVectorToScreen(vector) {
        const center = new THREE.Vector3(0, 0, 0);
        const tip = vector.clone();
        center.project(this.camera);
        tip.project(this.camera);
        const result = new THREE.Vector2(tip.x - center.x, tip.y - center.y);
        if (result.lengthSq() === 0) return result;
        return result.normalize();
    }

    queueMove(axis, index, dir, speed, options = {}) {
        const { isSolving = false, countsTowardsMoveCount = false } = options;
        this.moveQueue.push({ axis, index, dir, speed, isSolving, countsTowardsMoveCount });
        this.processQueue();
    }

    processQueue() {
        if (this.isAnimating || this.moveQueue.length === 0) return;
        const move = this.moveQueue.shift();
        if (!move.isSolving) {
            this.recordMoveInHistory(move);
        }
        this.updateHintAvailability();
        this.animateMove(move);
    }

    animateMove(move) {
        const { axis, index, dir, speed, countsTowardsMoveCount } = move;
        const duration = speed || 300;
        this.isAnimating = true;
        this.updateStatus('Status: Moving…');
        this.updateHintAvailability();

        const activeCubies = [];
        const epsilon = 0.1;
        this.allCubies.forEach(cubie => {
            const pos = new THREE.Vector3();
            cubie.getWorldPosition(pos);
            const localPos = pos.divideScalar(CUBE_SIZE + SPACING);
            if (Math.abs(localPos[axis] - index) < epsilon) activeCubies.push(cubie);
        });

        this.pivot.rotation.set(0, 0, 0);
        this.pivot.updateMatrixWorld();
        activeCubies.forEach(cubie => this.pivot.attach(cubie));

        const targetRotation = (Math.PI / 2) * dir * -1;
        const startTime = performance.now();

        const loop = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            this.pivot.rotation[axis] = targetRotation * ease;

            if (progress < 1) {
                requestAnimationFrame(loop);
            } else {
                this.pivot.rotation[axis] = targetRotation;
                this.pivot.updateMatrixWorld();

                activeCubies.forEach(cubie => {
                    this.scene.attach(cubie);
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
                    this.incrementMoveCounter();
                }
                this.isAnimating = false;
                this.updateStatus('Status: Ready');
                this.updateHintAvailability();
                this.processQueue();
            }
        };

        requestAnimationFrame(loop);
    }

    recordMoveInHistory(move) {
        this.moveHistory.push({ axis: move.axis, index: move.index, dir: move.dir });
        if (this.solveBtn) this.solveBtn.disabled = this.moveHistory.length === 0;
    }

    startShuffle() {
        if (this.isAnimating) return;
        this.resetMoveCounter();
        this.moveHistory = [];
        this.clearHintOverlay();
        const axes = ['x', 'y', 'z'];
        const indices = [-1, 0, 1];
        const dirs = [1, -1];
        const moves = 20;

        for (let i = 0; i < moves; i++) {
            const axis = axes[Math.floor(Math.random() * axes.length)];
            const index = indices[Math.floor(Math.random() * indices.length)];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            this.queueMove(axis, index, dir, ANIMATION_SPEED_SHUFFLE);
        }

        if (this.solveBtn) this.solveBtn.disabled = false;
        this.updateHintAvailability();
    }

    startSolve() {
        if (this.moveHistory.length === 0) return;
        this.moveQueue = [];
        const reversedHistory = [...this.moveHistory].reverse();
        reversedHistory.forEach(move => {
            this.queueMove(move.axis, move.index, move.dir * -1, ANIMATION_SPEED_SOLVE, { isSolving: true });
        });
        this.moveHistory = [];
        if (this.solveBtn) this.solveBtn.disabled = true;
        this.clearHintOverlay();
        this.updateHintAvailability();
    }

    resetCube() {
        if (this.isAnimating) return;
        this.moveQueue = [];
        this.moveHistory = [];
        this.clearHintOverlay();
        this.allCubies.forEach(cubie => this.scene.remove(cubie));
        this.allCubies = [];
        this.createRubiksCube();
        this.resetMoveCounter();
        this.updateStatus('Status: Reset');
        if (this.solveBtn) this.solveBtn.disabled = true;
        this.updateHintAvailability();
    }

    onKeyDown(event) {
        if (this.isAnimating || this.moveQueue.length > 0) return;
        const move = KEY_MOVES[event.key.toLowerCase()];
        if (!move) return;
        const dir = event.shiftKey ? -move.dir : move.dir;
        this.queueMove(move.axis, move.index, dir, ANIMATION_SPEED_MANUAL, { countsTowardsMoveCount: true });
    }

    onHintRequest() {
        if (this.isAnimating || this.moveQueue.length > 0) return;
        if (this.moveHistory.length === 0) {
            this.updateStatus('Hint: Куб уже собран — подсказка не требуется.');
            this.clearHintOverlay();
            return;
        }

        const lastMove = this.moveHistory[this.moveHistory.length - 1];
        const suggestedMove = {
            axis: lastMove.axis,
            index: lastMove.index,
            dir: lastMove.dir * -1
        };

        this.showHintOverlay(suggestedMove.axis, suggestedMove.index);
        this.updateStatus(`Hint: ${this.describeHintMove(suggestedMove)}`);
    }

    updateHintAvailability() {
        if (this.hintBtn) this.hintBtn.disabled = this.moveHistory.length === 0 || this.isAnimating || this.moveQueue.length > 0;
        if (this.solveBtn) this.solveBtn.disabled = this.moveHistory.length === 0;
    }

    showHintOverlay(axis, index) {
        this.clearHintOverlay();
        const size = (CUBE_SIZE + SPACING) * 3;
        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshBasicMaterial({
            color: 0x7c3aed,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide
        });
        this.hintOverlay = new THREE.Mesh(geometry, material);
        const layerPosition = index * (CUBE_SIZE + SPACING);

        if (axis === 'x') {
            this.hintOverlay.rotation.y = Math.PI / 2;
            this.hintOverlay.position.x = layerPosition;
        } else if (axis === 'y') {
            this.hintOverlay.rotation.x = Math.PI / 2;
            this.hintOverlay.position.y = layerPosition;
        } else {
            this.hintOverlay.position.z = layerPosition;
        }

        this.scene.add(this.hintOverlay);
    }

    clearHintOverlay() {
        if (this.hintOverlay) {
            this.scene.remove(this.hintOverlay);
            this.hintOverlay.geometry.dispose();
            this.hintOverlay.material.dispose();
            this.hintOverlay = null;
        }
    }

    describeHintMove(move) {
        const axisLabels = { x: 'X', y: 'Y', z: 'Z' };
        const dirLabel = move.dir === 1 ? 'clockwise' : 'counter-clockwise';
        return `Rotate ${axisLabels[move.axis]} layer at index ${move.index} ${dirLabel}`;
    }

    updateStatus(text) {
        if (this.statusEl) this.statusEl.textContent = text;
    }

    updateMoveCounter() {
        if (this.moveCounterEl) this.moveCounterEl.textContent = `Moves: ${moveCount}`;
    }

    resetMoveCounter() {
        moveCount = 0;
        this.updateMoveCounter();
    }

    incrementMoveCounter() {
        moveCount += 1;
        this.updateMoveCounter();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

const app = new CubeApp();

function updateHintAvailability() {
    app.updateHintAvailability();
}

function showHintOverlay(axis, index) {
    app.showHintOverlay(axis, index);
}
