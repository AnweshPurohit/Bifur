# ✨ Bifur: Thomas' Cyclical Chaos

Bifur is a high-performance **GPGPU particle simulation** that visualizes the beautiful, complex patterns of **Thomas' Cyclically Symmetric Attractor**. By combining chaos theory with modern web technologies, it creates an interactive, cosmic visualizer that reacts to your presence.

![Bifur Preview](https://via.placeholder.com/1200x600?text=Bifur+Cosmic+Simulation)

---

## 🌌 Mathematical Foundation

The soul of this animation is **Thomas' Cyclically Symmetric Attractor**, a 3D chaotic system introduced by the biologist René Thomas. It is celebrated for its cyclic symmetry and its ability to produce intricate, labyrinthine paths.

### The System of Equations

The movement of each of the **262,144 particles** is governed by the following system of non-linear differential equations:

$$
\begin{aligned}
\frac{dx}{dt} &= \sin(y) - b \cdot x \\
\frac{dy}{dt} &= \sin(z) - b \cdot y \\
\frac{dz}{dt} &= \sin(x) - b \cdot z
\end{aligned}
$$

### Key Parameters
- **$b$ (Dissipation Coefficient)**: This parameter controls how quickly the system converges toward the attractor. 
  - A lower value ($b \approx 0.2$) leads to high-entropy, chaotic behavior where particles explode into "tentacles."
  - A higher value ($b > 0.3$) pulls particles into tighter, more stable orbits.
- **Integration**: To ensure stability and precision, we use the **4th Order Runge-Kutta (RK4)** integration method. This allows for smooth motion even at higher simulation speeds.

---

## 🖐️ Interactive Gestures

Experience touchless control using **MediaPipe Hands**. Bifur maps your physical movements to the mathematical parameters of the universe:

| Action | Hand | Mechanism | Effect |
| :--- | :--- | :--- | :--- |
| **Zoom** | Right Hand | Index-Thumb Pinch | Scaler mapping to the scene's camera distance. |
| **Rotation** | Left Hand | Hand Rotation | Direct Z-axis rotation of the particle system. |
| **Cosmic Spread**| Left Hand | Index-Thumb Pinch | Modulates the $b$ parameter and radial force. |

> [!TIP]
> Use the **"Cosmic Reset"** button in the UI if the system becomes too chaotic or the particles drift too far.

---

## Technical Architecture

Bifur is built for extreme performance, offloading nearly all computation to the hardware:

- **GPGPU Simulation**: Particle positions are stored in floating-point textures and updated via GLSL fragment shaders (Ping-Pong rendering).
- **Three.js Core**: Manages the WebGL context, camera, and geometric primitives.
- **MediaPipe**: Drives the hands-free gesture engine.
- **Tweakpane**: Provides a sleek, glassmorphic UI for real-time parameter tuning.

## Getting Started

Since this project uses ES Modules and Webcam API, it must be served via **HTTPS** or **localhost**.

### Fast Start
If you have **Node.js**:
```bash
npx serve .
```

If you have **Python**:
```bash
python -m http.server 8000
```
