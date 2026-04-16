import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useThree, useLoader, useFrame as useFrameImpl } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Center, Line } from '@react-three/drei';
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
      camera={{ position: [0, 14, 42], fov: 34, near: 0.1, far: 1000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      shadows
      style={{ background: '#000' }}
    >
      <color attach="background" args={['#000000']} />

      {/* Clinical lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 30, 20]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} color="#fff" />
      <directionalLight position={[-10, 20, -15]} intensity={0.55} color="#eef" />
      <spotLight position={[0, 40, 5]} intensity={0.8} angle={0.5} penumbra={0.5} color="#fff" />
      <pointLight position={[0, -10, 25]} intensity={0.35} color="#ffeedd" />
      <pointLight position={[20, 5, -10]} intensity={0.28} color="#aaccff" />
      <pointLight position={[-20, 5, -10]} intensity={0.28} color="#aaccff" />

      <Suspense fallback={<LoadingIndicator />}>
        {scanUrl ? (
          <TreatmentJourney url={scanUrl} format={scanFormat} simulation={simulation} activeStateIndex={activeStateIndex} />
        ) : (
          <PlaceholderArch simulation={simulation} activeStateIndex={activeStateIndex} />
        )}
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={15}
        maxDistance={150}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, 0, 0]}
      />
      <Environment preset="studio" environmentIntensity={0.5} />
    </Canvas>
  );
}

/* ── Real STL/PLY Mesh Loader ─────────────────────────────── */

/**
 * Maps a clinical stage / treatment to a material tint applied to the
 * uploaded STL/PLY scan, so changing the timeline slider visibly
 * recolors the scan AND moves a floating "callout tooth" overlay.
 */
function getStageStyling(activeState) {
  const stage = activeState?.clinical_metrics?.stage;
  const treatment = activeState?.clinical_metrics?.treatment;
  const pocket = activeState?.clinical_metrics?.pocket_depth_mm;

  // Treatments take priority — use strong blue/white tones
  if (treatment === 'zirconia_crown' || treatment === 'rct_crown' || stage === 'restored') {
    return { color: '#c8e8ff', emissive: '#1a6fff', emissiveIntensity: 2.5, label: 'Restored', markerColor: '#4a9eff', aura: '#2266ff' };
  }
  if (treatment === 'composite_filling') {
    return { color: '#f0d890', emissive: '#d49010', emissiveIntensity: 2.0, label: 'Filled', markerColor: '#d4a04a', aura: '#cc9020' };
  }
  if (treatment === 'root_canal' || stage === 'endodontic') {
    return { color: '#c8a888', emissive: '#cc4422', emissiveIntensity: 2.2, label: 'Endo', markerColor: '#cc5544', aura: '#aa3322' };
  }

  // Disease progression — each stage significantly more severe
  switch (stage) {
    case 'enamel':
      return { color: '#d8c870', emissive: '#a07820', emissiveIntensity: 1.8, label: 'Enamel Lesion', markerColor: '#d4a030', aura: '#c89030' };
    case 'dentin':
      return { color: '#c09060', emissive: '#884010', emissiveIntensity: 2.5, label: 'Dentin Caries', markerColor: '#a05020', aura: '#904018' };
    case 'pulp':
      return { color: '#c06040', emissive: '#dd1111', emissiveIntensity: 3.0, label: 'Pulpitis', markerColor: '#ff3333', aura: '#cc1111' };
    case 'abscess':
      return { color: '#882020', emissive: '#ff1100', emissiveIntensity: 4.0, label: 'Abscess', markerColor: '#ff2200', aura: '#dd1100' };
    case 'extracted':
      return { color: '#604040', emissive: '#660000', emissiveIntensity: 1.5, label: 'Extracted', markerColor: '#882222', aura: '#550000' };
    default:
      break;
  }

  // Periodontal inflammation
  if (typeof pocket === 'number' && pocket > 5) {
    return { color: '#c07060', emissive: '#cc2211', emissiveIntensity: 2.0, label: 'Inflamed Gingiva', markerColor: '#dd3322', aura: '#bb2211' };
  }

  // Healthy / baseline — no tint
  return { color: '#f0ece4', emissive: '#000000', emissiveIntensity: 0, label: 'Healthy', markerColor: '#4ade80', aura: '#22cc44' };
}

/**
 * TreatmentJourney — a single scan that evolves through the timeline.
 *
 * The patient sees ONE mouth. As they drag the slider:
 *   • The affected tooth area is highlighted with a marker + aura
 *   • A magnified "tooth detail" callout to the right shows what's
 *     happening at that specific tooth at this point in time
 *   • The scan tint changes subtly (not a full red wash) to reflect
 *     overall health at that step
 *
 * This frames the slider as a treatment / projection journey rather
 * than a "before vs after" comparison.
 */
function TreatmentJourney({ url, format, simulation, activeStateIndex }) {
  const meshRef = useRef();
  const [geometry, setGeometry] = useState(null);
  const [bbox, setBbox] = useState(null);

  useEffect(() => {
    const loader = format === 'ply' ? new PLYLoader() : new STLLoader();
    loader.load(url, (geo) => {
      geo.computeVertexNormals();
      geo.center();
      geo.computeBoundingBox();
      const size = new THREE.Vector3();
      geo.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 22 / maxDim; // leave room for the side detail callout
      geo.scale(scale, scale, scale);
      geo.computeBoundingBox();
      const finalSize = new THREE.Vector3();
      geo.boundingBox.getSize(finalSize);
      setBbox({
        sizeX: finalSize.x,
        sizeY: finalSize.y,
        sizeZ: finalSize.z,
        topY: geo.boundingBox.max.y,
        frontZ: geo.boundingBox.max.z,
      });
      setGeometry(geo);
    });
  }, [url, format]);

  const activeState = simulation?.states?.[activeStateIndex] || null;
  const styling = useMemo(() => getStageStyling(activeState), [activeState]);
  const stage = activeState?.clinical_metrics?.stage;
  const isPulsing = ['pulp', 'abscess'].includes(stage);
  const isHealthy = styling.label === 'Healthy';

  // Drive the material imperatively so the slider always recolors the scan,
  // but with much SUBTLER intensity than before — we don't want the whole
  // arch glowing red. The marker + callout do the heavy lifting visually.
  useFrameImpl(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    mat.color.set(styling.color);
    mat.emissive.set(styling.emissive);
    // Scale intensity WAY down — the scan should look like a real scan,
    // not a horror movie. Only the affected zone gets dramatic.
    let intensity = styling.emissiveIntensity * 0.15;
    if (isPulsing) {
      intensity += Math.sin(clock.elapsedTime * 3) * 0.05;
    }
    mat.emissiveIntensity = Math.max(0, intensity);
  });

  if (!geometry || !bbox) return <LoadingIndicator />;

  // Position the affected-zone marker on the scan surface
  const markerPos = [0, bbox.topY - 0.5, bbox.frontZ * 0.55];

  // Position the magnified detail callout to the RIGHT of the scan
  const calloutPos = [bbox.sizeX * 0.55 + 6, 0, 0];
  const calloutSize = [3.0, 4.0, 2.2];

  // Shorthand month label for the callout header (e.g. "3 Months")
  const monthLabel = activeState?.label?.split('—')[0]?.trim() || '';
  const detailLabel = activeState?.label?.split('—')[1]?.trim() || activeState?.label || '';

  return (
    <group>
      {/* The patient's actual scan — kept looking like a scan */}
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={styling.color}
          emissive={styling.emissive}
          emissiveIntensity={styling.emissiveIntensity * 0.15}
          roughness={0.4}
          metalness={0.05}
          clearcoat={0.25}
          clearcoatRoughness={0.25}
        />
      </mesh>

      {/* Affected-zone marker on the scan */}
      {!isHealthy && (
        <>
          <PulseMarker position={markerPos} color={styling.markerColor} pulse={isPulsing} />
          <DiseaseAura
            position={[markerPos[0], markerPos[1] - 0.4, markerPos[2] - 0.4]}
            radius={Math.min(bbox.sizeX, bbox.sizeY) * 0.14}
            color={styling.aura || styling.markerColor}
            pulse={isPulsing}
          />
        </>
      )}

      {/* Dashed connector from marker on scan to callout tooth */}
      <Line
        points={[markerPos, [calloutPos[0], calloutPos[1] + calloutSize[1] * 0.2, calloutPos[2]]]}
        color={styling.markerColor}
        lineWidth={1}
        dashed
        dashSize={0.35}
        gapSize={0.25}
        transparent
        opacity={0.55}
      />

      {/* Magnified tooth detail callout (right side) */}
      <group position={calloutPos}>
        <ToothOverlay
          key={activeStateIndex}
          state={activeState}
          module={simulation?.module}
          targetTeeth={simulation?.target_teeth}
          toothNumber={simulation?.target_teeth?.[0]}
          toothSize={calloutSize}
        />

        {/* "Tooth #X" label above the callout */}
        <Html position={[0, calloutSize[1] * 0.7 + 1.5, 0]} center distanceFactor={18}>
          <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
            <div className="text-[10px] tracking-[0.25em] text-gray-500 font-semibold">DETAIL</div>
            <div className="px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap border border-white/20 bg-black/80 text-white">
              Tooth #{simulation?.target_teeth?.[0] || '—'}
            </div>
          </div>
        </Html>

        {/* Stage chip below the callout */}
        {activeState && (
          <Html position={[0, -calloutSize[1] * 0.7 - 1.2, 0]} center distanceFactor={18}>
            <div
              className="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border pointer-events-none select-none"
              style={{
                background: 'rgba(0,0,0,0.85)',
                borderColor: styling.markerColor,
                color: styling.markerColor,
              }}
            >
              {styling.label}
            </div>
          </Html>
        )}
      </group>

      {/* Top-of-scene timeline header */}
      {activeState && (
        <Html position={[0, bbox.topY + 4.5, 0]} center distanceFactor={22}>
          <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
            <div className="text-[10px] tracking-[0.3em] text-gray-500 font-semibold">TREATMENT TIMELINE</div>
            <div className="flex items-center gap-2 bg-black/85 px-3 py-1.5 rounded-lg border border-white/10">
              {monthLabel && (
                <span className="text-[14px] font-bold text-white">{monthLabel}</span>
              )}
              {monthLabel && detailLabel && (
                <span className="w-1 h-1 rounded-full bg-gray-600" />
              )}
              {detailLabel && (
                <span className="text-[12px] text-gray-300">{detailLabel}</span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Big translucent "aura" sphere highlighting the affected zone ── */

function DiseaseAura({ position, radius, color, pulse }) {
  const meshRef = useRef();
  useFrameImpl(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const baseOpacity = pulse ? 0.45 : 0.32;
    meshRef.current.material.opacity = baseOpacity + Math.sin(t * (pulse ? 3 : 1.2)) * 0.12;
    const baseScale = 1 + (pulse ? Math.sin(t * 3) * 0.08 : Math.sin(t * 1.2) * 0.04);
    meshRef.current.scale.set(baseScale, baseScale, baseScale);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}

/* ── Pulsing surface marker ─────────────────────────────────── */

function PulseMarker({ position, color, pulse }) {
  const ringRef = useRef();
  const dotRef = useRef();
  useFrameSafe(({ clock }) => {
    const t = clock.elapsedTime;
    if (ringRef.current) {
      const s = pulse ? 1 + Math.sin(t * 3) * 0.3 : 1 + Math.sin(t * 1.2) * 0.1;
      ringRef.current.scale.set(s, s, s);
      ringRef.current.material.opacity = pulse ? 0.6 + Math.sin(t * 3) * 0.3 : 0.5;
    }
    if (dotRef.current && pulse) {
      dotRef.current.material.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.4;
    }
  });

  return (
    <group position={position}>
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 1.0, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── Connector line between scan marker and callout tooth ──── */

function ConnectorLine({ from, to, color }) {
  return (
    <Line
      points={[from, to]}
      color={color}
      lineWidth={1.5}
      dashed
      dashSize={0.4}
      gapSize={0.25}
      transparent
      opacity={0.7}
    />
  );
}

/* Small wrapper so PulseMarker can call useFrame without crashing if drei tree changes */
function useFrameSafe(cb) {
  // Imported via @react-three/fiber at top of file
  // Local re-export to keep PulseMarker self-contained
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useFrameImpl(cb);
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
