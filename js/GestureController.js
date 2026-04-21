export class GestureController {
    constructor() {
        this.videoElement = document.getElementsByClassName('input_video')[0];

        // Output state - separated and smoothed
        this.state = {
            zoom: {
                active: false,
                value: 1.0,
                target: 1.0,
                ghostCounter: 0
            },
            rotation: {
                active: false,
                value: 0.0,
                target: 0.0,
                spread: 0.0, // New: Spread controlled by Left hand pinch
                targetSpread: 0.0,
                ghostCounter: 0
            },
            visuals: {
                right: { // Zoom Hand (T1, I1) - Physically Right (Screen Right when not mirrored)
                    t1: { x: 0.7, y: 0.5 },
                    i1: { x: 0.75, y: 0.5 },
                    targetT1: { x: 0.7, y: 0.5 },
                    targetI1: { x: 0.75, y: 0.5 }
                },
                left: { // Rotation Hand (T2, I2) - Physically Left (Screen Left when not mirrored)
                    t2: { x: 0.25, y: 0.5 },
                    i2: { x: 0.3, y: 0.5 },
                    targetT2: { x: 0.25, y: 0.5 },
                    targetI2: { x: 0.3, y: 0.5 }
                }
            }
        };

        this.GHOST_MAX = 10; // Frames to persist after loss

        this.canvas = document.getElementById('gesture_canvas');
        this.ctx = this.canvas.getContext('2d');

        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        // LITE MODEL FOR INSTANT TRACKING
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // 0 = Lite (Fastest)
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
            selfieMode: true
        });

        this.hands.onResults(this.onResults.bind(this));

        // REDUCED RESOLUTION FOR HIGH FRAME RATE
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.hands.send({ image: this.videoElement });
            },
            width: 640,
            height: 480
        });
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        this.camera.start();
    }

    update() {
        // SNAPPY RESPONSIVENESS
        const lerpSpeed = 0.15;

        // Handle Zoom (Right Hand)
        if (this.state.zoom.active || this.state.zoom.ghostCounter > 0) {
            this.state.zoom.value += (this.state.zoom.target - this.state.zoom.value) * lerpSpeed;
            if (!this.state.zoom.active) this.state.zoom.ghostCounter--;
        }

        // Handle Rotation (Left Hand)
        if (this.state.rotation.active || this.state.rotation.ghostCounter > 0) {
            let diff = this.state.rotation.target - this.state.rotation.value;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.state.rotation.value += diff * lerpSpeed;

            // Handle Spread (Left hand pinch)
            this.state.rotation.spread += (this.state.rotation.targetSpread - this.state.rotation.spread) * lerpSpeed;

            if (!this.state.rotation.active) this.state.rotation.ghostCounter--;
        }

        this.updateVisuals(0.2); // Faster visual smoothing to match responsiveness
        this.drawVisuals();
    }

    updateVisuals(lerp) {
        const lerpPoint = (current, target, alpha) => {
            const dx = target.x - current.x;
            const dy = target.y - current.y;
            // Deadband to kill micro-vibration
            if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return;
            current.x += dx * alpha;
            current.y += dy * alpha;
        };

        if (this.state.zoom.active || this.state.zoom.ghostCounter > 0) {
            lerpPoint(this.state.visuals.right.t1, this.state.visuals.right.targetT1, lerp);
            lerpPoint(this.state.visuals.right.i1, this.state.visuals.right.targetI1, lerp);
        }

        if (this.state.rotation.active || this.state.rotation.ghostCounter > 0) {
            lerpPoint(this.state.visuals.left.t2, this.state.visuals.left.targetT2, lerp);
            lerpPoint(this.state.visuals.left.i2, this.state.visuals.left.targetI2, lerp);
        }
    }

    drawVisuals() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 1;

        const drawHand = (t, i, labelT, labelI, statusText, color) => {
            const tp = { x: t.x * w, y: t.y * h };
            const ip = { x: i.x * w, y: i.y * h };

            ctx.strokeStyle = color;
            ctx.fillStyle = color;

            // String
            ctx.beginPath();
            ctx.moveTo(tp.x, tp.y);
            ctx.lineTo(ip.x, ip.y);
            ctx.stroke();

            // Dots
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ip.x, ip.y, 3, 0, Math.PI * 2); ctx.fill();

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(labelT, tp.x + 12, tp.y);
            ctx.fillText(labelI, ip.x + 12, ip.y);
            ctx.fillText(statusText, (tp.x + ip.x) / 2, (tp.y + ip.y) / 2 - 12);
        };

        // MONOCHROME MINIMALIST
        const white = 'rgba(255, 255, 255, 0.7)';

        if (this.state.zoom.active || this.state.zoom.ghostCounter > 0) {
            const dist = Math.round(this.state.zoom.target * 100);
            drawHand(this.state.visuals.right.t1, this.state.visuals.right.i1, 'T1', 'I1', `Dist: ${dist}%`, white);
        }

        if (this.state.rotation.active || this.state.rotation.ghostCounter > 0) {
            const deg = Math.round(this.state.rotation.target * (180 / Math.PI));
            const spreadPercent = Math.round(this.state.rotation.targetSpread * 100);
            drawHand(this.state.visuals.left.t2, this.state.visuals.left.i2, 'T2', 'I2', `Angle: ${deg}° | Spread: ${spreadPercent}%`, white);
        }
    }

    onResults(results) {
        let foundRotation = false; // Left Hand (Angle)
        let foundZoom = false;     // Right Hand (Zoom)

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const label = results.multiHandedness[i].label; // 'Left' or 'Right'

                // Mapping based on physical hand identity (Handedness)
                // 'Left' label = Physical Left Hand -> Angle (Rotation)
                // 'Right' label = Physical Right Hand -> Zoom
                if (label === 'Left') {
                    this.updateRotation(landmarks);
                    foundRotation = true;
                } else if (label === 'Right') {
                    this.updateZoom(landmarks);
                    foundZoom = true;
                }
            }
        }

        // Persistence Logic
        if (foundRotation) {
            this.state.rotation.active = true;
            this.state.rotation.ghostCounter = this.GHOST_MAX;
        } else {
            this.state.rotation.active = false;
        }

        if (foundZoom) {
            this.state.zoom.active = true;
            this.state.zoom.ghostCounter = this.GHOST_MAX;
        } else {
            this.state.zoom.active = false;
        }
    }

    updateZoom(landmarks) {
        const t = landmarks[4];
        const i = landmarks[8];
        const w = landmarks[0];
        const m = landmarks[9];

        this.state.visuals.right.targetT1 = { x: t.x, y: t.y };
        this.state.visuals.right.targetI1 = { x: i.x, y: i.y };

        const d = Math.sqrt(Math.pow(t.x - i.x, 2) + Math.pow(t.y - i.y, 2));
        const s = Math.sqrt(Math.pow(w.x - m.x, 2) + Math.pow(w.y - m.y, 2));

        let val = Math.min(Math.max(((s > 0.001 ? d / s : 0) - 0.2) / 0.5, 0), 1);
        this.state.zoom.target = val;
    }

    updateRotation(landmarks) {
        const t = landmarks[4];
        const i = landmarks[8];
        const w = landmarks[0];
        const m = landmarks[9];

        this.state.visuals.left.targetT2 = { x: t.x, y: t.y };
        this.state.visuals.left.targetI2 = { x: i.x, y: i.y };

        // 1. Rotation Logic
        const dx = t.x - i.x;
        const dy = t.y - i.y;
        this.state.rotation.target = Math.atan2(dy, dx);

        // 2. Spread Logic (Pinch)
        const d = Math.sqrt(Math.pow(t.x - i.x, 2) + Math.pow(t.y - i.y, 2));
        const s = Math.sqrt(Math.pow(w.x - m.x, 2) + Math.pow(w.y - m.y, 2));
        let spreadVal = Math.min(Math.max(((s > 0.001 ? d / s : 0) - 0.2) / 0.5, 0), 1);
        this.state.rotation.targetSpread = spreadVal;
    }

    getValues() {
        return this.state;
    }
}
