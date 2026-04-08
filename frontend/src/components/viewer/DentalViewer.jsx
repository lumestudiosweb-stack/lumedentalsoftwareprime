import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Center } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import ToothOverlay, { RealisticTooth } from './ToothOverlay';

/**
 * Main 3D Dental Viewer — loads real STL/PLY scans and overlays
 * disease/treatment simulations on specific teeth.
 *
 * Camera positioned for a front-facing clinical view looking slightly
 * down into the mouth — like a patient in the chair.
 */
export default function DentalViewer({ scanUrl, scanFormat, simulation, activeStateIndex }) {
  return (
    <Canvas
      camera={{ position: [0, 18, 38], fov: 32, near: 0.1, far: 1000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      shadows
      style={{ background: '#000' }}
    >
      <color attach="background" args={['#000000']} />

      {/* Lighting — bright clinical with rim light */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 30, 20]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} color="#fff" />
      <directionalLight position={[-10, 20, -15]} intensity={0.6} color="#eef" />
      <spotLight position={[0, 40, 5]} intensity={0.9} angle={0.5} penumbra={0.5} color="#fff" />
      <pointLight position={[0, -10, 25]} intensity={0.4} color="#ffeedd" />
      {/* Rim lights for depth */}
      <pointLight position={[20, 5, -10]} intensity={0.3} color="#aaccff" />
      <pointLight position={[-20, 5, -10]} intensity={0.3} color="#aaccff" />

      <Suspense fallback={<LoadingIndicator />}>
        {scanUrl ? (
          <ScanMesh url={scanUrl} format={scanFormat} simulation={simulation} activeStateIndex={activeStateIndex} />
        ) : (
          <PlaceholderArch simulation={simulation} activeStateIndex={activeStateIndex} />
        )}
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={100}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, 0, 0]}
      />
      <Environment preset="studio" />
    </Canvas>
  );
}

/* ── Real STL/PLY Mesh Loader ─────────────────────────────── */

function ScanMesh({ url, format, simulation, activeStateIndex }) {
  const meshRef = useRef();
  const [geometry, setGeometry] = useState(null);

  useEffect(() => {
    const loader = format === 'ply' ? new PLYLoader() : new STLLoader();
    loader.load(url, (geo) => {
      geo.computeVertexNormals();
      geo.center();
      geo.computeBoundingBox();
      const size = new THREE.Vector3();
      geo.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 30 / maxDim;
      geo.scale(scale, scale, scale);
      setGeometry(geo);
    });
  }, [url, format]);

  if (!geometry) return <LoadingIndicator />;

  const activeState = simulation?.states?.[activeStateIndex];

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial color="#f0ece4" roughness={0.35} metalness={0.05} clearcoat={0.3} clearcoatRoughness={0.2} />
      </mesh>
      {activeState && simulation && (
        <ToothOverlay state={activeState} module={simulation.module} targetTeeth={simulation.target_teeth} toothNumber={simulation.target_teeth?.[0]} />
      )}
      {activeState?.label && (
        <Html position={[0, 20, 0]} center>
          <div className="bg-black/90 text-white px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap border border-white/10">
            {activeState.label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Tooth data generator ───────────────────────────────────── */

function generateTeethData() {
  const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeft  = [21, 22, 23, 24, 25, 26, 27, 28];
  const lowerLeft  = [31, 32, 33, 34, 35, 36, 37, 38];
  const lowerRight = [41, 42, 43, 44, 45, 46, 47, 48];

  const result = [];

  function addTeeth(teeth, arch, side) {
    teeth.forEach((fdi, idx) => {
      const pos = fdi % 10;
      const isMolar = pos >= 6;
      const isPremolar = pos >= 4 && pos < 6;
      const isCanine = pos === 3;

      // Bigger, more realistic tooth dimensions
      const width = isMolar ? 1.3 : isPremolar ? 0.95 : isCanine ? 0.8 : (pos === 1 ? 0.85 : 0.65);
      const height = isMolar ? 1.0 : isPremolar ? 1.2 : isCanine ? 1.5 : (pos === 1 ? 1.4 : 1.1);
      const depth = isMolar ? 1.2 : isPremolar ? 0.9 : isCanine ? 0.7 : 0.5;
      const toothType = isMolar ? 'molar' : isPremolar ? 'premolar' : isCanine ? 'canine' : 'incisor';

      // U-shaped arch — wider and more realistic proportions
      const posInArch = idx;
      const t = posInArch / 7;

      const archWidth = 14;
      const archDepth = 16;
      let x, z;

      if (side === 'right') {
        x = -(1 - t) * archWidth * 0.92 - t * 0.6;
        z = (1 - t) * (1 - t) * archDepth - archDepth * 0.25;
      } else {
        x = (1 - t) * archWidth * 0.92 + t * 0.6;
        z = (1 - t) * (1 - t) * archDepth - archDepth * 0.25;
      }

      // Upper and lower arches separated more
      const y = arch === 'upper' ? 2.5 : -2.5;

      let angle;
      if (t > 0.8) {
        angle = side === 'right' ? -0.1 : 0.1;
      } else {
        const curveAngle = Math.atan2(x, z);
        angle = -curveAngle;
      }

      result.push({ fdi, x, y, z, width, height, depth, angle, toothType, arch });
    });
  }

  addTeeth(upperRight, 'upper', 'right');
  addTeeth(upperLeft, 'upper', 'left');
  addTeeth(lowerRight, 'lower', 'right');
  addTeeth(lowerLeft, 'lower', 'left');

  return result;
}

/* ── Procedural Dental Arch ─────────────────────────────────── */

function PlaceholderArch({ simulation, activeStateIndex }) {
  const groupRef = useRef();
  const activeState = simulation?.states?.[activeStateIndex];
  const targetTeeth = simulation?.target_teeth || [];

  const teeth = useMemo(() => generateTeethData(), []);
  const isPerioInflamed = activeState?.clinical_metrics?.pocket_depth_mm > 5;

  return (
    <group ref={groupRef} rotation={[0.15, 0, 0]}>
      {/* Upper Gingiva */}
      <GumTissue
        teeth={teeth.filter((t) => t.arch === 'upper')}
        yOffset={2.5}
        color={isPerioInflamed ? '#a83228' : '#c47872'}
        arch="upper"
      />
      {/* Lower Gingiva */}
      <GumTissue
        teeth={teeth.filter((t) => t.arch === 'lower')}
        yOffset={-2.5}
        color="#c47872"
        arch="lower"
      />

      {/* Individual teeth */}
      {teeth.map((tooth) => {
        const isTarget = targetTeeth.includes(tooth.fdi);
        return (
          <group key={tooth.fdi} position={[tooth.x, tooth.y, tooth.z]} rotation={[0, tooth.angle, 0]}>
            {isTarget && activeState ? (
              <ToothOverlay
                state={activeState}
                module={simulation?.module}
                targetTeeth={targetTeeth}
                toothNumber={tooth.fdi}
                toothSize={[tooth.width, tooth.height, tooth.depth]}
              />
            ) : (
              <RealisticTooth w={tooth.width} h={tooth.height} d={tooth.depth} toothType={tooth.toothType} />
            )}
            {/* Tooth number label */}
            <Html position={[0, tooth.arch === 'upper' ? 2.0 : -2.0, 0]} center>
              <div className={`text-[9px] px-1 rounded select-none ${
                isTarget ? 'bg-white text-black font-bold' : 'text-gray-600'
              }`}>
                {tooth.fdi}
              </div>
            </Html>
          </group>
        );
      })}

      {/* State label */}
      {activeState?.label && (
        <Html position={[0, 10, 0]} center>
          <div className="bg-black/90 text-white px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap border border-white/10">
            {activeState.label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Gum tissue — follows arch shape ──────────────────────── */

function GumTissue({ teeth, yOffset, color, arch }) {
  return (
    <group>
      {teeth.map((tooth, i) => {
        const nextTooth = teeth[i + 1];
        if (!nextTooth) return null;

        const midX = (tooth.x + nextTooth.x) / 2;
        const midZ = (tooth.z + nextTooth.z) / 2;
        const dx = nextTooth.x - tooth.x;
        const dz = nextTooth.z - tooth.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);
        const gumY = arch === 'upper' ? yOffset - 0.4 : yOffset + 0.4;

        return (
          <mesh key={`gum-${tooth.fdi}`} position={[midX, gumY, midZ]} rotation={[0, -angle, 0]} castShadow>
            <boxGeometry args={[2.0, 1.4, dist + 0.5]} />
            <meshPhysicalMaterial
              color={color}
              roughness={0.85}
              metalness={0}
              clearcoat={0.1}
              clearcoatRoughness={0.6}
            />
          </mesh>
        );
      })}
      {teeth.map((tooth) => {
        const gumY = arch === 'upper' ? yOffset - 0.4 : yOffset + 0.4;
        return (
          <mesh key={`gum-cap-${tooth.fdi}`} position={[tooth.x, gumY, tooth.z]} castShadow>
            <cylinderGeometry args={[1.0, 0.95, 1.4, 12]} />
            <meshPhysicalMaterial
              color={color}
              roughness={0.85}
              metalness={0}
              clearcoat={0.1}
              clearcoatRoughness={0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Loading indicator ──────────────────────────────────────── */

function LoadingIndicator() {
  return (
    <Html center>
      <div className="text-gray-400 text-xs flex items-center gap-2 font-medium">
        <div className="w-3 h-3 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
        Loading 3D scan...
      </div>
    </Html>
  );
}
