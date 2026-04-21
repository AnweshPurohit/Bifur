# Bifur - Interactive Cosmic Particle System

Bifur is a high-performance GPGPU particle simulation that combines chaos mathematics with advanced web technologies to create a stunning, interactive cosmic visualizer.

![Bifur Preview](https://via.placeholder.com/800x450.png?text=Bifur+Particle+System) *(Replace with actual screenshot if available)*

## 🚀 Overview

The project simulates over **262,144 particles** (512x512) in real-time using WebGL shaders. The movement of these particles is driven by chaotic equations, specifically utilizing a bifur parameter to create intricate, organic patterns that resemble nebulae and cosmic structures.

### Key Features
- **GPGPU Simulation**: Particle positions and physics are calculated entirely on the GPU for maximum performance.
- **Hand Gesture Control**: Integrated with **MediaPipe Hands** to allow touchless interaction.
- **Cosmic Aesthetics**: Additive blending, trail effects, and dynamic gradients create a premium visual experience.
- **Real-time Tweaking**: Use the built-in Tweakpane to adjust chaos parameters, speed, and visuals on the fly.

## 🖐️ Gesture Controls

If you have a webcam, you can control the particles directly with your hands:

| Action | Hand | Gesture |
| :--- | :--- | :--- |
| **Zoom** | Right Hand | Pinch (Index to Thumb) distance controls scale. |
| **Rotation** | Left Hand | Rotating your hand rotates the particle system. |
| **Tentacle Spread** | Left Hand | Pinch (Index to Thumb) controls the spread/chaos intensity. |

*Note: You can toggle "Hand Control" in the UI panel.*

## 💻 Tech Stack
- **Three.js**: 3D rendering and scene management.
- **MediaPipe**: Real-time hand tracking and gesture recognition.
- **GLSL Shaders**: Custom simulation and rendering shaders.
- **Tweakpane**: Sleek UI for parameter control.

## 🛠️ How to Run

Since the project uses ES Modules and requires webcam access, it **must be served via a web server**. Running it by simply opening the `index.html` file in your browser will not work.

### Using Python (Simplest)
If you have Python installed, run this command in the `Bifur` folder:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

### Using Node.js (npx)
If you have Node.js installed, run:
```bash
npx serve .
```
Then follow the link provided in the terminal.

### Using VS Code
1. Install the **Live Server** extension.
2. Right-click `index.html` and select **"Open with Live Server"**.

---
*Created with ❤️ by Antigravity*
