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
 */
export default function DentalViewer({ scanUrl, scanFormat, simulation, activeStateIndex }) {
  return (
    <Canvas
      camera={{ position: [0, 35, 55], fov: 38, near: 0.1, far: 1000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      shadows
    >
      <color attach="background" args={['#0f172a']} />

      {/* Lighting — dental operatory style */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 35, 15]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-15, 25, -10]} intensity={0.5} />
      <spotLight position={[0, 45, 5]} intensity={0.7} angle={0.4} penumbra={0.6} />
      <pointLight position={[0, -10, 20]} intensity={0.3} color="#ffeedd" />

      <Suspense fallback={<LoadingIndicator />}>
        {scanUrl ? (
          <ScanMesh
            url={scanUrl}
            format={scanFormat}
            simulation={simulation}
            activeStateIndex={activeStateIndex}
          />
        ) : (
          <PlaceholderArch simulation={simulation} activeStateIndex={activeStateIndex} />
        )}
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={15}
        maxDistance={120}
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
      const box = geo.boundingBox;
      const size = new THREE.Vector3();
      box.getSize(size);
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
        <meshPhysicalMaterial
          color="#f0ece4"
          roughness={0.35}
          metalness={0.05}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {activeState && simulation && (
        <ToothOverlay
          state={activeState}
          module={simulation.module}
          targetTeeth={simulation.target_teeth}
          toothNumber={simulation.target_teeth?.[0]}
        />
      )}

      {activeState?.label && (
        <Html position={[0, 20, 0]} center>
          <div className="bg-black/80 text-white px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap backdrop-blur-sm border border-white/10">
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

      // Tooth dimensions
      const width = isMolar ? 1.15 : isPremolar ? 0.85 : isCanine ? 0.72 : (pos === 1 ? 0.7 : 0.6);
      const height = isMolar ? 0.85 : isPremolar ? 1.05 : isCanine ? 1.35 : (pos === 1 ? 1.25 : 1.0);
      const depth = isMolar ? 1.05 : isPremolar ? 0.8 : isCanine ? 0.6 : 0.45;
      const toothType = isMolar ? 'molar' : isPremolar ? 'premolar' : isCanine ? 'canine' : 'incisor';

      // Position along a U-shaped arch (parabolic curve)
      // Incisors at front, molars at back
      const posInArch = idx; // 0 = most posterior (8/molar), 7 = most anterior (1/central incisor)
      const t = posInArch / 7; // 0..1 from back to front

      const archWidth = 13;
      const archDepth = 14;
      let x, z;

      if (side === 'right') {
        // Right side: negative x
        x = -(1 - t) * archWidth * 0.95 - t * 0.5;
        z = (1 - t) * (1 - t) * archDepth - archDepth * 0.3;
      } else {
        // Left side: positive x
        x = (1 - t) * archWidth * 0.95 + t * 0.5;
        z = (1 - t) * (1 - t) * archDepth - archDepth * 0.3;
      }

      const y = arch === 'upper' ? 1.5 : -1.5;

      // Rotation: teeth angle to follow the arch curve
      let angle;
      if (t > 0.8) {
        // Front teeth — face forward
        angle = side === 'right' ? -0.1 : 0.1;
      } else {
        // Side/back teeth — angle along the arch
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

  // Generate gum shape points
  const upperGumShape = useMemo(() => {
    const upperTeeth = teeth.filter((t) => t.arch === 'upper');
    return createGumPath(upperTeeth);
  }, [teeth]);

  const lowerGumShape = useMemo(() => {
    const lowerTeeth = teeth.filter((t) => t.arch === 'lower');
    return createGumPath(lowerTeeth);
  }, [teeth]);

  const isPerioInflamed = activeState?.clinical_metrics?.pocket_depth_mm > 5;

  return (
    <group ref={groupRef}>
      {/* Upper Gingiva */}
      <GumTissue
        teeth={teeth.filter((t) => t.arch === 'upper')}
        yOffset={1.5}
        color={isPerioInflamed ? '#c0392b' : '#e8948d'}
        arch="upper"
      />
      {/* Lower Gingiva */}
      <GumTissue
        teeth={teeth.filter((t) => t.arch === 'lower')}
        yOffset={-1.5}
        color="#e8948d"
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
              <RealisticTooth
                w={tooth.width}
                h={tooth.height}
                d={tooth.depth}
                toothType={tooth.toothType}
              />
            )}
            {/* Tooth number label */}
            <Html position={[0, tooth.arch === 'upper' ? 1.5 : -1.5, 0]} center>
              <div className={`text-[9px] px-1 rounded select-none ${
                isTarget ? 'bg-lume-600 text-white font-bold' : 'text-gray-500/70'
              }`}>
                {tooth.fdi}
              </div>
            </Html>
          </group>
        );
      })}

      {/* State label */}
      {activeState?.label && (
        <Html position={[0, 8, 0]} center>
          <div className="bg-black/80 text-white px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap backdrop-blur-sm border border-white/10">
            {activeState.label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Gum tissue — follows arch shape ──────────────────────── */

function GumTissue({ teeth, yOffset, color, arch }) {
  // Create a thick gum band that follows the teeth positions
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
        const gumY = arch === 'upper' ? yOffset - 0.3 : yOffset + 0.3;

        return (
          <mesh key={`gum-${tooth.fdi}`} position={[midX, gumY, midZ]} rotation={[0, -angle, 0]} castShadow>
            <boxGeometry args={[1.8, 1.2, dist + 0.4]} />
            <meshPhysicalMaterial
              color={color}
              roughness={0.82}
              metalness={0}
              clearcoat={0.15}
              clearcoatRoughness={0.5}
            />
          </mesh>
        );
      })}
      {/* Rounded caps at ends and fill gaps */}
      {teeth.map((tooth) => {
        const gumY = arch === 'upper' ? yOffset - 0.3 : yOffset + 0.3;
        return (
          <mesh key={`gum-cap-${tooth.fdi}`} position={[tooth.x, gumY, tooth.z]} castShadow>
            <cylinderGeometry args={[0.9, 0.85, 1.2, 10]} />
            <meshPhysicalMaterial
              color={color}
              roughness={0.82}
              metalness={0}
              clearcoat={0.15}
              clearcoatRoughness={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function createGumPath(teeth) {
  return teeth.map((t) => new THREE.Vector2(t.x, t.z));
}

/* ── Loading indicator ──────────────────────────────────────── */

function LoadingIndicator() {
  return (
    <Html center>
      <div className="text-white text-sm flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Loading 3D scan...
      </div>
    </Html>
  );
}
