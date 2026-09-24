import { useEffect, useRef } from "react";
import { useThemeStore } from "../../store/themeStore";

const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uLight;
  out vec4 outputColor;

  float hash(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
    float t = uTime * 0.06;
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(
      fbm(p + 1.6 * q + vec2(1.7, 9.2) + 0.15 * t),
      fbm(p + 1.6 * q + vec2(8.3, 2.8) - 0.12 * t)
    );
    float f = fbm(p + 1.8 * r);
    vec2 pointer = (uPointer - 0.5) * 2.0;
    float glow = 0.12 / (0.12 + distance(p, pointer * 0.6));
    vec3 base = mix(vec3(0.025, 0.035, 0.055), vec3(0.075, 0.255, 0.420), uLight);
    vec3 pearl = mix(vec3(0.94, 0.96, 1.0), vec3(0.78, 0.88, 0.97), uLight);
    vec3 silver = mix(vec3(0.60, 0.66, 0.74), vec3(0.36, 0.62, 0.80), uLight);
    vec3 color = base;
    color = mix(color, pearl, clamp(f * f * 0.95, 0.0, 0.72));
    color = mix(color, silver, clamp(r.x * 0.32, 0.0, 0.28));
    color += pearl * glow * 0.14;
    float vignette = smoothstep(1.25, 0.2, length(p));
    color *= mix(0.55, 1.0, vignette);
    color += (hash(uv + t) - 0.5) * 0.015;
    outputColor = vec4(color, 1.0);
  }
`;

const VERTEX_SHADER = `#version 300 es
  in vec2 position;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export default function AnimatedShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const lightRef = useRef(theme === "light" ? 1 : 0);

  useEffect(() => {
    lightRef.current = theme === "light" ? 1 : 0;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!canvas || !gl) return;

    const program = createProgram(gl);
    const buffer = gl.createBuffer();
    if (!program || !buffer) {
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const lightLocation = gl.getUniformLocation(program, "uLight");
    const pointer = { x: 0.5, y: 0.5 };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };
    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      pointer.y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
    };
    const draw = (elapsed: number) => {
      resize();
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, elapsed);
      gl.uniform2f(pointerLocation, pointer.x, pointer.y);
      gl.uniform1f(lightLocation, lightRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointer);
    resize();

    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId = 0;
    const start = performance.now();
    const renderFrame = (now: number) => {
      draw((now - start) / 1000);
      frameId = window.requestAnimationFrame(renderFrame);
    };
    if (reducedMotion) draw(8);
    else frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointer);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />;
}
