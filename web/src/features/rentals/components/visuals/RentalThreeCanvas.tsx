"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferAttribute, CanvasTexture, CatmullRomCurve3, Color, DoubleSide, PlaneGeometry, SRGBColorSpace, Vector3, type Mesh, type Sprite } from "three";

export type RentalSceneVariant = "trips" | "order" | "package" | "pipeline";
export type RentalThreeCanvasProps = { variant: RentalSceneVariant; progress?: number };

const W = 22, D = 16;
const PEAKS = [
  { x: -3.8, z: -0.8, h: 4.7, r: 2.5, name: "Fansipan", alt: "3.143 m · 14/11" },
  { x: 4.4, z: 2.2, h: 3.4, r: 2.3, name: "Tà Xùa", alt: "2.865 m · 21/11" },
  { x: 1.2, z: -4.4, h: 3.5, r: 2.1, name: "Lảo Thẩn", alt: "2.860 m · 05/12" },
];
const PIPELINE: Array<[string, number, string]> = [["Chờ thanh toán", 6, "#F0893A"], ["Đang chuẩn bị", 9, "#8FD3A9"], ["Sẵn sàng giao", 5, "#5FC48A"], ["Đang thuê", 51, "#2F9A62"], ["Chờ kiểm tra", 7, "#6FA8E8"], ["Hoàn tất 30 ngày", 128, "#E9E5D8"]];
const STAGES = ["Thanh toán", "Chuẩn bị", "Bàn giao", "Đang thuê", "Thu hồi", "Kiểm định", "Quyết toán cọc"];
const TIMES = ["20/10 21:04", "23/10 15:30", "24/10 05:40", "24 – 26/10", "26/10 17:40", "27/10 09:15", "27/10 11:02"];
const ROUTE: Array<[number, number]> = [[-8.5, 5.5], [-6.5, 4.2], [-5.2, 2.6], [-6, 0.8], [-4.6, -0.2], [-2.6, 0.6], [-1.2, -1.2], [0.2, -2.6], [1.2, -4]];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function hash(x: number, z: number) { const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return value - Math.floor(value); }
function noise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number) {
  let sum = 0, amplitude = 0.5, frequency = 1;
  for (let index = 0; index < 5; index += 1) { sum += amplitude * noise(x * frequency, z * frequency); frequency *= 2.03; amplitude *= 0.5; }
  return sum;
}
function heightAt(x: number, z: number) {
  let height = fbm(x * 0.24 + 3.1, z * 0.24 + 7.7) * 2.3 - 0.5 + 0.55 * Math.abs(Math.sin(x * 0.55 + z * 0.35));
  for (const peak of PEAKS) height += peak.h * Math.exp(-((x - peak.x) ** 2 + (z - peak.z) ** 2) / (peak.r * peak.r));
  const edge = Math.max(0, Math.min((W / 2 - Math.abs(x)) / 2.2, (D / 2 - Math.abs(z)) / 2.2, 1));
  return Math.max(0.04, height * edge * edge * (3 - 2 * edge));
}
function terrainColor(height: number) {
  const bands: Array<[number, string]> = [[0.45, "#16301F"], [1, "#214A33"], [1.7, "#33623F"], [2.5, "#55744E"], [3.3, "#857F67"], [4.1, "#B3AC96"], [99, "#ECE8DC"]];
  return bands.find(([limit]) => height < limit)?.[1] ?? "#fff";
}

function Terrain() {
  const { solid, grid } = useMemo(() => {
    const geometry = new PlaneGeometry(W, D, 90, 66); geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) position.setY(index, heightAt(position.getX(index), position.getZ(index)));
    const flat = geometry.toNonIndexed(), flatPosition = flat.attributes.position, colors = new Float32Array(flatPosition.count * 3), color = new Color();
    for (let index = 0; index < flatPosition.count; index += 3) {
      const height = (flatPosition.getY(index) + flatPosition.getY(index + 1) + flatPosition.getY(index + 2)) / 3;
      color.set(terrainColor(height));
      for (let offset = 0; offset < 3; offset += 1) colors.set([color.r, color.g, color.b], (index + offset) * 3);
    }
    flat.setAttribute("color", new BufferAttribute(colors, 3)); flat.computeVertexNormals();
    return { solid: flat, grid: geometry };
  }, []);
  return <group><mesh geometry={solid}><meshStandardMaterial vertexColors flatShading roughness={1} /></mesh><mesh geometry={grid} position-y={0.012}><meshBasicMaterial color="#fff" wireframe transparent opacity={0.045} /></mesh><mesh position-y={-0.33}><boxGeometry args={[W, 0.7, D]} /><meshStandardMaterial color="#0F2318" roughness={1} /></mesh><Clouds /></group>;
}

function Clouds() {
  const reduced = useReducedMotion(), refs = useRef<Array<Sprite | null>>([]);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d")!, gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255,255,255,.9)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); return new CanvasTexture(canvas);
  }, []);
  const clouds = useMemo(() => Array.from({ length: 7 }, (_, index) => ({ scale: [5 + hash(index, 9) * 5, 2.5 + hash(index, 9) * 2.5, 1] as [number, number, number], position: [(hash(index, 1) - 0.5) * W, 4.3 + hash(index, 2) * 1.5, (hash(index, 5) - 0.5) * D] as [number, number, number], speed: 0.15 + hash(index, 7) * 0.25 })), []);
  useFrame((_, delta) => { if (!reduced) refs.current.forEach((sprite, index) => { if (sprite) { sprite.position.x += clouds[index].speed * Math.min(delta, 0.05); if (sprite.position.x > W / 2 + 3) sprite.position.x = -W / 2 - 3; } }); });
  return <>{clouds.map((cloud, index) => <sprite key={index} ref={(item) => { refs.current[index] = item; }} position={cloud.position} scale={cloud.scale}><spriteMaterial map={texture} transparent opacity={0.25} depthWrite={false} /></sprite>)}</>;
}

function Pin({ x, z, active = false }: { x: number; z: number; active?: boolean }) {
  const y = heightAt(x, z);
  return <group position={[x, y, z]}><mesh position-y={0.45}><cylinderGeometry args={[0.025, 0.025, 0.9, 6]} /><meshBasicMaterial color="#EEF4EF" transparent opacity={0.8} /></mesh><mesh position-y={0.9}><sphereGeometry args={[active ? 0.16 : 0.13, 16, 12]} /><meshBasicMaterial color={active ? "#fff" : "#F0893A"} /></mesh><mesh rotation-x={-Math.PI / 2} position-y={0.03}><ringGeometry args={[0.18, 0.29, 32]} /><meshBasicMaterial color="#F0893A" transparent opacity={0.7} side={DoubleSide} /></mesh></group>;
}
function Label({ x, y, z, title, sub, hot = false }: { x: number; y: number; z: number; title: string | number; sub?: string; hot?: boolean }) {
  return <Html position={[x, y, z]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}><span className={`block min-w-max rounded-[9px] border px-3 py-2 text-left text-[11px] leading-tight shadow-xl backdrop-blur ${hot ? "border-orange-300/50 bg-[#f58b36] text-[#271205]" : "border-white/10 bg-[#071b13]/85 text-white"}`}><b className="block font-black">{title}</b>{sub ? <span className={`mt-1 block ${hot ? "text-[#5c2a08]" : "text-emerald-100/65"}`}>{sub}</span> : null}</span></Html>;
}
function TripsScene() { return <><Terrain />{PEAKS.map((peak, index) => <group key={peak.name}><Pin x={peak.x} z={peak.z} active={index === 0} /><Label x={peak.x} y={heightAt(peak.x, peak.z) + 1.35} z={peak.z} title={peak.name} sub={peak.alt} hot={index === 0} /></group>)}</>; }

function OrderScene({ progress = 0.72 }: { progress?: number }) {
  const points = useMemo(() => { const curve = new CatmullRomCurve3(ROUTE.map(([x, z]) => new Vector3(x, heightAt(x, z) + 0.1, z))); return curve.getSpacedPoints(240).map((point) => new Vector3(point.x, heightAt(point.x, point.z) + 0.1, point.z)); }, []);
  const curve = useMemo(() => new CatmullRomCurve3(points), [points]);
  const marks = useMemo(() => STAGES.map((_, index) => curve.getPointAt(index / 6)), [curve]);
  const current = Math.min(6, Math.max(0, Math.round(progress * 6)));
  const done = useMemo(() => new CatmullRomCurve3(points.slice(0, Math.max(2, Math.round((current / 6) * (points.length - 1)) + 1))), [current, points]);
  return <><Terrain /><mesh><tubeGeometry args={[curve, 300, 0.045, 6, false]} /><meshBasicMaterial color="#EEF4EF" transparent opacity={0.3} /></mesh><mesh><tubeGeometry args={[done, 260, 0.075, 8, false]} /><meshBasicMaterial color="#F0893A" /></mesh>{marks.map((point, index) => <group key={STAGES[index]}><Pin x={point.x} z={point.z} active={index === current} /><Label x={point.x} y={point.y + 0.9} z={point.z} title={STAGES[index]} sub={TIMES[index]} hot={index === current} /></group>)}</>;
}

function makeQrTexture() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!; context.fillStyle = "#F4EBDD"; context.fillRect(0, 0, 256, 256); context.fillStyle = "#0B1A13";
  let seed = 7331;
  for (let y = 0; y < 21; y += 1) for (let x = 0; x < 21; x += 1) { seed = (seed * 9301 + 49297) % 233280; if (seed / 233280 > 0.5) context.fillRect(28 + x * 9.5, 28 + y * 9.5, 10, 10); }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
}
function PackageScene() {
  const texture = useMemo(() => makeQrTexture(), []), box = useRef<Mesh>(null), reduced = useReducedMotion();
  useFrame(({ clock }) => { if (box.current && !reduced) box.current.position.y = 0.68 + Math.sin(clock.elapsedTime * 1.6) * 0.05; });
  return <><mesh ref={box} position-y={0.68}><boxGeometry args={[2.2, 1.3, 1.6]} /><meshStandardMaterial attach="material-0" color="#C79B6B" /><meshStandardMaterial attach="material-1" color="#C79B6B" /><meshStandardMaterial attach="material-2" map={texture} /><meshStandardMaterial attach="material-3" color="#C79B6B" /><meshStandardMaterial attach="material-4" color="#C79B6B" /><meshStandardMaterial attach="material-5" color="#C79B6B" /></mesh><mesh rotation-x={-Math.PI / 2}><circleGeometry args={[1.9, 32]} /><meshBasicMaterial color="#000" transparent opacity={0.22} /></mesh></>;
}
function PipelineScene() {
  const heights = PIPELINE.map(([, count]) => 0.35 + Math.sqrt(count) * 0.38);
  return <><mesh position-y={-0.07}><boxGeometry args={[11, 0.14, 2.2]} /><meshStandardMaterial color="#173A2A" /></mesh>{PIPELINE.map(([name, count, color], index) => { const x = (index - 2.5) * 1.7; return <group key={name}><mesh position={[x, heights[index] / 2, 0]}><boxGeometry args={[0.8, heights[index], 0.8]} /><meshStandardMaterial color={color} flatShading /></mesh><Label x={x} y={heights[index] + 0.4} z={0} title={count} sub={name} hot={index === 3} /></group>; })}</>;
}

export function RentalThreeCanvas({ variant, progress }: RentalThreeCanvasProps) {
  const packageView = variant === "package", pipelineView = variant === "pipeline";
  return <Canvas flat dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} camera={{ fov: 36, position: packageView ? [4.3, 3.1, 4.5] : pipelineView ? [8, 6.4, 10] : [9, 7.2, 15], near: 0.1, far: 200 }} fallback={<p className="p-6 text-sm text-emerald-100">Thiết bị chưa hỗ trợ WebGL.</p>}>
    {!packageView && !pipelineView ? <fog attach="fog" args={["#0B1A13", 22, 46]} /> : null}<hemisphereLight args={["#E4F1E8", "#10221A", 1.6]} /><directionalLight position={[9, 14, 7]} intensity={2.4} color="#FFE2B4" />
    {variant === "trips" ? <TripsScene /> : null}{variant === "order" ? <OrderScene progress={progress} /> : null}{variant === "package" ? <PackageScene /> : null}{variant === "pipeline" ? <PipelineScene /> : null}
    <OrbitControls enableZoom={false} enablePan={false} enableDamping autoRotate autoRotateSpeed={packageView ? 2.2 : 0.35} minPolarAngle={0.35} maxPolarAngle={1.32} />
  </Canvas>;
}
