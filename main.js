import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pane } from 'tweakpane';
import { simVertexShader, simFragmentShader, renderVertexShader, renderFragmentShader } from './shaders.js';
import { GestureController } from './js/GestureController.js';

// Configuration
const CONFIG = {
    particleCountSqrt: 512, // 512x512 = 262,144 particles
    b: 0.20818, // Mathematical parameter
    dt: 0.05,
    pointSize: 1.0,
    opacity: 0.1,
    scale: 1.0,
    colorA: '#ff8800', // Nebula Orange
    colorB: '#00ffff', // Nebula Blue
    bgColor: '#000000',
    trailOpacity: 0.1,
    useGestures: true
};

// Global variables
let renderer, scene, camera, controls;
let simScene, simCamera; // For GPGPU pass
let rts = []; // Render Targets (ping-pong)
let currentRtIndex = 0;
let particleMesh, simMaterial;
let trailMesh, trailMaterial; // For trails effect
let gestureController;
let pane;

init();
animate();

function init() {
    // 1. Setup Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: false }); // Depth false for additive blending performance
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // 2. Main Scene (For rendering particles)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.bgColor);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 12);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // 3. GPGPU Setup
    initGPGPU();

    // 4. Particles Setup
    initParticles();

    // 5. Trails Setup
    initTrails();

    // 6. UI
    pane = initUI();

    // 7. Gestures
    initGestures();

    // 8. Resize handler
    window.addEventListener('resize', onWindowResize);
}

function initGestures() {
    gestureController = new GestureController();
    gestureController.start();
}

function initGPGPU() {
    simScene = new THREE.Scene();
    simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create Float Textures for Position
    const size = CONFIG.particleCountSqrt;
    // We need Full Float support!
    if (!renderer.capabilities.isWebGL2 && !renderer.extensions.get('OES_texture_float')) {
        alert("This demo requires WebGL2 or OES_texture_float extension.");
    }

    // Initial Data Texture
    const initialTexture = createInitialDataTexture(size);

    // Ping-Pong Targets - only create once
    if (rts.length === 0) {
        rts = [
            new THREE.WebGLRenderTarget(size, size, {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                stencilBuffer: false,
                depthBuffer: false
            }),
            new THREE.WebGLRenderTarget(size, size, {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                stencilBuffer: false,
                depthBuffer: false
            })
        ];
    }

    // Material for simulation
    simMaterial = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: initialTexture },
            time: { value: 0.0 },
            dt: { value: CONFIG.dt },
            b: { value: CONFIG.b },
            uSpread: { value: 0.0 } // New: Controlled by Left Hand Pinch
        },
        vertexShader: simVertexShader,
        fragmentShader: simFragmentShader
    });

    // Clean up old mesh if exists (though we only call initGPGPU once or for reset)
    while (simScene.children.length > 0) {
        simScene.remove(simScene.children[0]);
    }

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    simScene.add(plane);

    // Reset simulation: Render initial state to BOTH targets
    // We use a simple copy shader (or just the sim shader with dt=0? No, sim shader does math).
    // We need to COPY the initialTexture to the render targets.
    // Sim shader reads from 'map'. If we set 'map' to 'initialTexture' and run one pass, 
    // it will calculate next step. We want EXACT initial positions.
    // Hack: Just run sim shader with dt=0?
    // Let's try dt=0.

    simMaterial.uniforms.map.value = initialTexture;
    simMaterial.uniforms.dt.value = 0;

    renderer.setRenderTarget(rts[0]);
    renderer.render(simScene, simCamera);

    renderer.setRenderTarget(rts[1]);
    renderer.render(simScene, simCamera);

    renderer.setRenderTarget(null);

    // Restore dt
    simMaterial.uniforms.dt.value = CONFIG.dt;
}

function createInitialDataTexture(size) {
    const data = new Float32Array(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
        // Random start positions around center
        data[i] = (Math.random() - 0.5) * 5.0; // x
        data[i + 1] = (Math.random() - 0.5) * 5.0; // y
        data[i + 2] = (Math.random() - 0.5) * 5.0; // z
        data[i + 3] = Math.random(); // life or extra
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
}

function initParticles() {
    const size = CONFIG.particleCountSqrt;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(size * size * 3); // UV hooks

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const index = (i * size + j) * 3;
            positions[index] = j / size; // u
            positions[index + 1] = i / size; // v
            positions[index + 2] = 0;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: null }, // Will be updated each frame
            pointSize: { value: CONFIG.pointSize },
            opacity: { value: CONFIG.opacity },
            uSpread: { value: 0.0 },
            uColorA: { value: new THREE.Color(CONFIG.colorA) },
            uColorB: { value: new THREE.Color(CONFIG.colorB) }
        },
        vertexShader: renderVertexShader,
        fragmentShader: renderFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particleMesh = new THREE.Points(geometry, material);
    scene.add(particleMesh);
}

function initTrails() {
    // For trails, we need to preserve the previous frame.
    // By default, Three.js clears the canvas. global autoClear = false.
    renderer.autoClearColor = false;

    // We create a full screen quad that is black with low opacity
    // to "fade" the previous frame.
    const geometry = new THREE.PlaneGeometry(200, 200); // Big enough to cover frustum or use fullscreen camera
    // Better: Helper function to render a fullscreen quad purely.
    // But adding a big mesh in the back of the camera works too.
    // Or we can use the `preserveDrawingBuffer` webgl context option + manual clearing with a rect.

    // Let's use the manual clear approach:
    // Every frame:
    // 1. Draw a semi-transparent black full-screen quad over the existing screen.
    // 2. Draw new particles.

    // Just putting a Quad in the scene is easiest for VR/Camera moves?
    // Actually, if we use "autoClear = false", we can just render a huge black quad in front of the camera (but behind particles?) 
    // No, standard way for this effect:
    // Render a fullscreen quad with low opacity black.

    // Let's try `renderer.autoClear = false`.
    // And manually clear with opacity? No `renderer.clear` clears everything.

    // We will render a "Fade Mesh" at the very beginning of the frame.
}

function initUI() {
    const p = new Pane({ title: 'Bifur Control' });

    p.addBinding(CONFIG, 'useGestures', { label: 'Hand Control' });
    p.addBinding(CONFIG, 'b', { min: 0.1, max: 0.3, step: 0.00001, label: 'Chaos (b)' });
    p.addBinding(CONFIG, 'dt', { min: 0.001, max: 0.1, label: 'Speed' });
    p.addBinding(CONFIG, 'pointSize', { min: 0.1, max: 10.0, label: 'Size' });
    p.addBinding(CONFIG, 'scale', { min: 0.1, max: 5.0, label: 'Manual Scale', readonly: true });

    const visualFolder = p.addFolder({ title: 'Visuals' });
    visualFolder.addBinding(CONFIG, 'opacity', { min: 0.01, max: 1.0 });
    visualFolder.addBinding(CONFIG, 'trailOpacity', { min: 0.0, max: 0.2, label: 'Trail Fade' });
    // Removed Single Color binding as we use gradient now
    const cosmicFolder = p.addFolder({ title: 'Cosmic Vibe (Nebula)' });
    cosmicFolder.addBinding(CONFIG, 'colorA', { view: 'color', label: 'Core Color' }).on('change', (ev) => {
        particleMesh.material.uniforms.uColorA.value.set(ev.value);
    });
    cosmicFolder.addBinding(CONFIG, 'colorB', { view: 'color', label: 'Nebula Color' }).on('change', (ev) => {
        particleMesh.material.uniforms.uColorB.value.set(ev.value);
    });

    p.addButton({ title: 'Cosmic Reset' }).on('click', () => {
        initGPGPU();
    });

    return p;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.001;
    controls.update();

    // Gesture Updates
    // Gesture Updates
    if (CONFIG.useGestures && gestureController) {
        // Run smoothing update
        gestureController.update();

        const gestures = gestureController.getValues();

        // === RIGHT HAND: ZOOM ===
        // MediaPipe 'Left' -> User Right -> Zoom
        // gestures.zoom.value is smoothed 0.0-1.0
        if (gestures.zoom.active) {
            const minScale = 0.2;
            const maxScale = 2.5;
            // Map 0..1 to Scale Range
            const targetScale = minScale + (gestures.zoom.value * (maxScale - minScale));

            // Direct assignment because GestureController handles smoothing
            CONFIG.scale = targetScale;
            particleMesh.scale.set(CONFIG.scale, CONFIG.scale, CONFIG.scale);
        }

        // === LEFT HAND: ROTATION ===
        // MediaPipe 'Right' -> User Left -> Rotation
        // gestures.rotation.value is smoothed angle (radians)
        if (gestures.rotation.active) {
            // Apply rotation directly
            // gestures.rotation.value is the smoothed angle
            // We can map it directly to Z rotation

            // The value is in radians. 
            // We want intuitive control: Rotating hand rotates object.
            // A simple 1:1 map is usually best for "accuracy".
            particleMesh.rotation.z = gestures.rotation.value;

            // === LEFT HAND PINCH: TENTACLE SPREAD ===
            // This drives the beautiful cosmic spreading
            const spreadValue = gestures.rotation.spread; // Smoothed 0..1
            simMaterial.uniforms.uSpread.value = spreadValue;
            particleMesh.material.uniforms.uSpread.value = spreadValue;
        }

        pane.refresh();
    }

    // 1. GPGPU Step
    // Read from currentRtIndex, write to next
    const read = rts[currentRtIndex];
    const write = rts[currentRtIndex ^ 1];

    simMaterial.uniforms.map.value = read.texture;
    simMaterial.uniforms.time.value = time;
    simMaterial.uniforms.dt.value = CONFIG.dt;
    simMaterial.uniforms.b.value = CONFIG.b;

    renderer.setRenderTarget(write);
    renderer.render(simScene, simCamera);
    renderer.setRenderTarget(null); // Back to screen

    // Swap
    currentRtIndex ^= 1;

    // 2. Fade Previous Frame (Trails)
    // We want to fade the entire screen by drawing a black rect with low alpha
    // We can use a simple scissor or just a fast clears? No, clears are absolute.
    // We need to blend black on top.

    // Temporarily disable depth test to draw full screen quad
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false; // We manage clearing

    // Fade pass
    // We can do this by using a full screen quad with opacity
    // Or simpler: Enable the scissor test to clear with low alpha? No that's not how it works.

    // Let's create a Fade Material on the fly or reuse one if performance matters
    if (!trailMaterial) {
        trailMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: CONFIG.trailOpacity
        });
        trailMesh = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), trailMaterial);
        // Ensure it's always in front of camera but behind particles?
        // Actually, if we just render this quad first, it draws over the PREVIOUS frame's buffer.
        // It pushes everything to background color.
    }

    trailMaterial.opacity = CONFIG.trailOpacity;
    trailMaterial.color.set(CONFIG.bgColor); // Use bgColor to fade to current background

    // To render the fade quad, we need a camera that looks at it, or just put it in front of the main camera.
    // Best way: Use a separate scene/camera for the fade pass to ensure it covers screen.
    if (!window.fadeScene) {
        window.fadeScene = new THREE.Scene();
        window.fadeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const fadePlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMaterial);
        window.fadeScene.add(fadePlane);
    }

    renderer.render(window.fadeScene, window.fadeCamera);

    // 3. Render Particles
    particleMesh.material.uniforms.map.value = write.texture; // Use the NEW positions
    particleMesh.material.uniforms.pointSize.value = CONFIG.pointSize;
    particleMesh.material.uniforms.opacity.value = CONFIG.opacity;
    // Update point size if we had it as uniform, but we hardcoded calculation in shader for now
    // Let's add uniform if needed, or rely on gl_PointSize

    renderer.render(scene, camera);

    // restore?
    // renderer.autoClear is false, so next frame we start with this frame's pixels
}
