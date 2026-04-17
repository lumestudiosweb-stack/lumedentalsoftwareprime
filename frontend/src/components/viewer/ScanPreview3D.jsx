import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import { Loader2 } from 'lucide-react';

/* ── Procedural dental coloring ─────────────────────────────────────────── */
function applyProceduralDentalColors(geo) {
  if (!geo.attributes.position) return;
  if (!geo.attributes.normal) geo.computeVertexNormals();

  const positions = geo.attributes.position;
  const normals   = geo.attributes.normal;
  const count     = positions.count;

  // Detect arch orientation
  let upCount = 0, downCount = 0;
  const step = Math.max(1, Math.floor(count / 2000));
  for (let i = 0; i < count; i += step) {
    const ny = normals.getY(i);
    if (ny > 0.5) upCount++;
    else if (ny < -0.5) downCount++;
  }
  const teethAtTop = upCount >= downCount; // upper arch → teeth face up

  // Bounding box
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const rangeY = bb.max.y - bb.min.y;

  // Palette
  const enamel  = new THREE.Color('#f2e6c8'); // ivory/cream
  const cervical= new THREE.Color('#d4a96a'); // cervical/CEJ area
  const sulcus  = new THREE.Color('#8b3a4a'); // dark sulcus
  const gum     = new THREE.Color('#c5566a'); // pink gingiva
  const gumDeep = new THREE.Color('#a03050'); // deeper gum

  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const y    = positions.getY(i);
    const ny   = normals.getY(i);

    // tNorm: 0 = gum end, 1 = tooth tip
    let tNorm = (y - bb.min.y) / rangeY;
    if (!teethAtTop) tNorm = 1 - tNorm;

    let color;
    if (tNorm > 0.68) {
      // Tooth tip — pure enamel
      color = enamel.clone();
    } else if (tNorm > 0.55) {
      // Cervical enamel transitioning
      const t = (tNorm - 0.55) / 0.13;
      color = cervical.clone().lerp(enamel, t);
    } else if (tNorm > 0.42) {
      // Sulcus / gingival margin
      const t = (tNorm - 0.42) / 0.13;
      color = sulcus.clone().lerp(cervical, t);
    } else if (tNorm > 0.22) {
      // Free gingiva / attached gingiva
      const t = (tNorm - 0.22) / 0.20;
      color = gum.clone().lerp(sulcus, t);
    } else {
      // Deep gum / alveolar
      const t = tNorm / 0.22;
      color = gumDeep.clone().lerp(gum, t);
    }

    // Subtle normal-based shading for depth
    const facingUp = teethAtTop ? ny : -ny;
    if (tNorm > 0.55 && facingUp > 0.3) {
      // Occlusal surface — slightly lighter
      color.lerp(new THREE.Color('#fff8ee'), facingUp * 0.25);
    }

    colors[i * 3]     = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/* ── Scan mesh loader ────────────────────────────────────────────────────── */
function ScanMesh({ url, format }) {
  const meshRef = useRef();
  const [geo, setGeo] = useState(null);
  const [hasVertexColors, setHasVertexColors] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const finishGeo = (g) => {
      if (cancelled) return;
      g.computeVertexNormals();
      g.computeBoundingBox();

      // Center geometry
      const center = new THREE.Vector3();
      g.boundingBox.getCenter(center);
      g.translate(-center.x, -center.y, -center.z);

      const native = g.attributes.color && g.attributes.color.count > 0;
      if (!native) {
        applyProceduralDentalColors(g);
      }
      setHasVertexColors(true);
      setGeo(g);
    };

    const fmt = (format || '').toLowerCase();

    if (fmt === 'stl') {
      new STLLoader().load(url, finishGeo);
    } else if (fmt === 'ply') {
      new PLYLoader().load(url, finishGeo);
    } else if (fmt === 'obj') {
      new OBJLoader().load(url, (obj) => {
        let combined = null;
        obj.traverse((child) => {
          if (child.isMesh && !combined) combined = child.geometry.clone();
        });
        if (combined) finishGeo(combined);
      });
    }

    return () => { cancelled = true; };
  }, [url, format]);

  // Auto-rotate gently
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });

  if (!geo) return null;

  // Scale to fit ~20 units
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = Math.max(
    bb.max.x - bb.min.x,
    bb.max.y - bb.min.y,
    bb.max.z - bb.min.z
  );
  const scale = 20 / (size || 1);

  return (
    <mesh ref={meshRef} geometry={geo} scale={[scale, scale, scale]}>
      <meshStandardMaterial
        vertexColors={hasVertexColors}
        roughness={0.55}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Public component ────────────────────────────────────────────────────── */
export default function ScanPreview3D({ scanUrl, scanFormat, className = '' }) {
  if (!scanUrl) return null;

  return (
    <div className={`relative rounded-xl overflow-hidden bg-[#0a0a0a] ${className}`}>
      <Canvas
        camera={{ position: [0, 8, 28], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0d0d0d']} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[10, 20, 10]} intensity={2.2} castShadow />
        <directionalLight position={[-8, 5, -10]} intensity={0.8} color="#ffd0b0" />
        <pointLight position={[0, -15, 0]} intensity={0.5} color="#ff9999" />

        <Suspense fallback={null}>
          <ScanMesh url={scanUrl} format={scanFormat} />
          <OrbitControls
            enablePan={false}
            minDistance={10}
            maxDistance={50}
            enableDamping
            dampingFactor={0.08}
          />
          <Environment preset="studio" />
        </Suspense>
      </Canvas>

      {/* Label */}
      <div className="absolute top-2 left-3 text-[10px] text-gray-500 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
        3D Preview · Drag to rotate
      </div>
    </div>
  );
}
