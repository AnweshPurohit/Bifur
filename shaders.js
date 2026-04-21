export const simVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const simFragmentShader = `
uniform sampler2D map;
uniform float time;
uniform float dt;
uniform float b;
uniform float uSpread; // New: Controlled by Left hand pinch

varying vec2 vUv;

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vUv;
    vec4 data = texture2D(map, uv);
    vec3 pos = data.rgb;

    // Modulate mathematical parameter 'b' with spread
    // Lower b creates more expansive, tentacle-like divergence
    float effectiveB = b * (1.0 - uSpread * 0.5);

    // RK4 Integration with Cosmic Spread Factor
    vec3 k1;
    k1.x = sin(pos.y) - effectiveB * pos.x;
    k1.y = sin(pos.z) - effectiveB * pos.y;
    k1.z = sin(pos.x) - effectiveB * pos.z;

    vec3 pos_k2 = pos + k1 * dt * 0.5;
    vec3 k2;
    k2.x = sin(pos_k2.y) - effectiveB * pos_k2.x;
    k2.y = sin(pos_k2.z) - effectiveB * pos_k2.y;
    k2.z = sin(pos_k2.x) - effectiveB * pos_k2.z;

    vec3 pos_k3 = pos + k2 * dt * 0.5;
    vec3 k3;
    k3.x = sin(pos_k3.y) - effectiveB * pos_k3.x;
    k3.y = sin(pos_k3.z) - effectiveB * pos_k3.y;
    k3.z = sin(pos_k3.x) - effectiveB * pos_k3.z;

    vec3 pos_k4 = pos + k3 * dt;
    vec3 k4;
    k4.x = sin(pos_k4.y) - effectiveB * pos_k4.x;
    k4.y = sin(pos_k4.z) - effectiveB * pos_k4.y;
    k4.z = sin(pos_k4.x) - effectiveB * pos_k4.z;

    vec3 nextPos = pos + (k1 + 2.0*k2 + 2.0*k3 + k4) * (dt / 6.0);
    
    // Radial Cosmic Spread: Particles push away from center based on uSpread
    float dist = length(nextPos);
    if (dist > 0.01) {
        nextPos += normalize(nextPos) * uSpread * 0.05;
    }

    // Bounds check
    if(length(nextPos) > 12.0) {
        nextPos = vec3(
            (rand(uv + time) - 0.5) * 8.0,
            (rand(uv + time + 1.0) - 0.5) * 8.0,
            (rand(uv + time + 2.0) - 0.5) * 8.0
        );
    }

    gl_FragColor = vec4(nextPos, 1.0);
}
`;

export const renderVertexShader = `
uniform sampler2D map;
uniform float pointSize;
varying vec3 vPos;
varying float vMagnitude;

void main() {
    vec4 data = texture2D(map, position.xy);
    vPos = data.rgb;
    vMagnitude = length(vPos);
    
    vec4 mvPosition = modelViewMatrix * vec4(vPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = pointSize * (40.0 / -mvPosition.z);
    gl_PointSize = max(1.0, gl_PointSize);
}
`;

export const renderFragmentShader = `
uniform float opacity;
uniform float uSpread;
uniform vec3 uColorA; // Nebula Color 1 (e.g. Orange)
uniform vec3 uColorB; // Nebula Color 2 (e.g. Blue)
varying vec3 vPos;
varying float vMagnitude;

vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
}

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    if(length(coord) > 0.5) discard;
    
    float strength = 1.0 - (length(coord) * 2.0);
    strength = pow(strength, 2.5); // Softer glow

    // SPATIAL NEBULA MIXING
    // Mix ColorA and ColorB based on spatial position (X-axis)
    // Map X from range ~[-10, 10] to [0, 1]
    float mixFactor = clamp((vPos.x / 10.0 + 1.0) * 0.5, 0.0, 1.0);
    
    // Add some noise/oscillation based on distance and spread for the "vibe"
    mixFactor = clamp(mixFactor + sin(vMagnitude * 0.5 - uSpread * 2.0) * 0.2, 0.0, 1.0);

    vec3 baseCore = mix(uColorA, uColorB, mixFactor);
    
    // Cosmic Glow: Blend toward white/cyan core based on density/magnitude
    vec3 col = mix(baseCore, vec3(1.0, 1.0, 1.0), uSpread * 0.2);

    // Brightness boost based on spread
    col *= (1.5 + uSpread * 1.5);

    gl_FragColor = vec4(col, opacity * strength);
}
`;
