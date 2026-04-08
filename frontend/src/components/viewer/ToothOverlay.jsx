import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ToothOverlay — renders disease/treatment state on a specific tooth.
 * Uses realistic rounded geometry instead of boxes.
 */
export default function ToothOverlay({ state, module, toothNumber, toothSize }) {
  const [w, h, d] = toothSize || [0.9, 1.1, 0.7];
  const stage = state?.clinical_metrics?.stage || 'initial';
  const treatment = state?.clinical_metrics?.treatment || '';
  const toothType = getToothType(toothNumber);

  // Route to correct visualization
  if (treatment === 'zirconia_crown' || treatment === 'rct_crown') return <CrownOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (treatment === 'composite_filling') return <CompositeFillingOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (treatment === 'root_canal') return <RCTOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (stage === 'extracted') return <ExtractionSocket w={w} d={d} />;
  if (stage === 'abscess') return <AbscessOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (stage === 'pulp') return <PulpitisOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (stage === 'dentin') return <DentinCariesOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (stage === 'enamel') return <EnamelCariesOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (stage === 'restored') return <CrownOverlay w={w} h={h} d={d} toothType={toothType} />;
  if (stage === 'endodontic') return <RCTOverlay w={w} h={h} d={d} toothType={toothType} />;

  return <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#f0ece4" />;
}

function getToothType(num) {
  if (!num) return 'molar';
  const pos = num % 10;
  if (pos >= 6) return 'molar';
  if (pos >= 4) return 'premolar';
  if (pos === 3) return 'canine';
  return 'incisor';
}

/* ── REALISTIC TOOTH BASE ─────────────────────────────────── */

export function RealisticTooth({ w, h, d, toothType, color = '#f0ece4', roughness = 0.28, clearcoat = 0.5, emissive, emissiveIntensity = 0 }) {
  const matProps = {
    color,
    roughness,
    metalness: 0.03,
    clearcoat,
    clearcoatRoughness: 0.15,
    ...(emissive ? { emissive, emissiveIntensity } : {}),
  };

  if (toothType === 'molar') return <MolarShape w={w} h={h} d={d} matProps={matProps} />;
  if (toothType === 'premolar') return <PremolarShape w={w} h={h} d={d} matProps={matProps} />;
  if (toothType === 'canine') return <CanineShape w={w} h={h} d={d} matProps={matProps} />;
  return <IncisorShape w={w} h={h} d={d} matProps={matProps} />;
}

/* ── MOLAR — wide with 4 cusps and rounded body ──────────── */
function MolarShape({ w, h, d, matProps }) {
  return (
    <group>
      {/* Main body — rounded cylinder */}
      <mesh castShadow position={[0, -h * 0.1, 0]}>
        <cylinderGeometry args={[w * 0.45, w * 0.4, h * 0.65, 16, 1]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Crown top — slightly wider */}
      <mesh castShadow position={[0, h * 0.15, 0]}>
        <cylinderGeometry args={[w * 0.48, w * 0.46, h * 0.25, 16, 1]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* 4 cusps */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx * w * 0.17, h * 0.32, cz * d * 0.17]} castShadow>
          <sphereGeometry args={[w * 0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshPhysicalMaterial {...matProps} />
        </mesh>
      ))}
      {/* Root (below gumline — subtle) */}
      <mesh position={[0, -h * 0.55, 0]}>
        <coneGeometry args={[w * 0.25, h * 0.4, 8]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ── PREMOLAR — 2 cusps ──────────────────────────────────── */
function PremolarShape({ w, h, d, matProps }) {
  return (
    <group>
      <mesh castShadow position={[0, -h * 0.05, 0]}>
        <cylinderGeometry args={[w * 0.38, w * 0.33, h * 0.7, 12, 1]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* 2 cusps — buccal and lingual */}
      {[[-1, 0], [1, 0]].map(([cz], i) => (
        <mesh key={i} position={[0, h * 0.35, cz * d * 0.12]} castShadow>
          <sphereGeometry args={[w * 0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshPhysicalMaterial {...matProps} />
        </mesh>
      ))}
      <mesh position={[0, -h * 0.55, 0]}>
        <coneGeometry args={[w * 0.18, h * 0.45, 8]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ── CANINE — single pointed cusp ────────────────────────── */
function CanineShape({ w, h, d, matProps }) {
  return (
    <group>
      {/* Body — tapered cylinder */}
      <mesh castShadow position={[0, -h * 0.05, 0]}>
        <cylinderGeometry args={[w * 0.32, w * 0.28, h * 0.7, 12, 1]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Pointed cusp tip */}
      <mesh castShadow position={[0, h * 0.35, 0]}>
        <coneGeometry args={[w * 0.28, h * 0.3, 12]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Long root */}
      <mesh position={[0, -h * 0.6, 0]}>
        <coneGeometry args={[w * 0.16, h * 0.55, 8]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ── INCISOR — flat blade shape ──────────────────────────── */
function IncisorShape({ w, h, d, matProps }) {
  return (
    <group>
      {/* Flat blade body */}
      <mesh castShadow position={[0, 0, 0]}>
        <capsuleGeometry args={[w * 0.22, h * 0.5, 8, 12]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Incisal edge — flat top */}
      <mesh castShadow position={[0, h * 0.38, 0]}>
        <boxGeometry args={[w * 0.5, h * 0.08, d * 0.35]} />
        <meshPhysicalMaterial {...matProps} />
      </mesh>
      {/* Root */}
      <mesh position={[0, -h * 0.55, 0]}>
        <coneGeometry args={[w * 0.14, h * 0.5, 8]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ── ENAMEL CARIES — small brown spot on occlusal ────────── */

function EnamelCariesOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#ede8dc" roughness={0.35} clearcoat={0.3} />
      {/* Brown spot */}
      <mesh position={[0, h * 0.38, 0]}>
        <sphereGeometry args={[w * 0.12, 12, 12]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      {/* Staining ring */}
      <mesh position={[0, h * 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[w * 0.08, w * 0.18, 16]} />
        <meshStandardMaterial color="#a07828" roughness={0.85} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── DENTIN CARIES — deeper cavity, darker ───────────────── */

function DentinCariesOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#e5ddd0" roughness={0.4} clearcoat={0.2} />
      {/* Deep cavity hole */}
      <mesh position={[0, h * 0.32, 0]}>
        <cylinderGeometry args={[w * 0.15, w * 0.2, 0.25, 16]} />
        <meshStandardMaterial color="#5C3310" roughness={0.95} />
      </mesh>
      {/* Dark center — depth */}
      <mesh position={[0, h * 0.2, 0]}>
        <sphereGeometry args={[w * 0.1, 10, 10]} />
        <meshStandardMaterial color="#3a1f08" roughness={1.0} />
      </mesh>
      {/* Demineralization halo */}
      <mesh position={[0, h * 0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[w * 0.14, w * 0.28, 16]} />
        <meshStandardMaterial color="#c4a35a" roughness={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── PULPITIS — red inflamed pulp ────────────────────────── */

function PulpitisOverlay({ w, h, d, toothType }) {
  const pulseRef = useRef();
  useFrame(({ clock }) => {
    if (pulseRef.current) {
      pulseRef.current.material.emissiveIntensity = Math.sin(clock.elapsedTime * 3) * 0.15 + 0.85;
    }
  });

  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#d5ccc0" roughness={0.5} clearcoat={0.1} />
      {/* Deep cavity */}
      <mesh position={[0, h * 0.25, 0]}>
        <cylinderGeometry args={[w * 0.16, w * 0.22, 0.35, 16]} />
        <meshStandardMaterial color="#3a1f08" roughness={0.95} />
      </mesh>
      {/* Inflamed pulp — pulsing red */}
      <mesh ref={pulseRef} position={[0, -h * 0.05, 0]}>
        <sphereGeometry args={[w * 0.18, 16, 16]} />
        <meshStandardMaterial color="#cc1a1a" emissive="#cc1a1a" emissiveIntensity={0.8} roughness={0.6} transparent opacity={0.85} />
      </mesh>
      {/* Pain rays */}
      {[0, 72, 144, 216, 288].map((angle) => (
        <mesh key={angle} position={[
          Math.cos(angle * Math.PI / 180) * w * 0.45,
          h * 0.1,
          Math.sin(angle * Math.PI / 180) * d * 0.45
        ]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.6} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ── ABSCESS — swelling at root ──────────────────────────── */

function AbscessOverlay({ w, h, d, toothType }) {
  const pulseRef = useRef();
  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.08;
      pulseRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#b0a898" roughness={0.6} clearcoat={0} />
      {/* Deep destruction on top */}
      <mesh position={[0, h * 0.25, 0]}>
        <cylinderGeometry args={[w * 0.18, w * 0.24, 0.3, 16]} />
        <meshStandardMaterial color="#2a1505" roughness={1.0} />
      </mesh>
      {/* Dead pulp */}
      <mesh position={[0, -h * 0.05, 0]}>
        <sphereGeometry args={[w * 0.14, 10, 10]} />
        <meshStandardMaterial color="#555" roughness={0.9} />
      </mesh>
      {/* Periapical abscess — pulsing mass at root tip */}
      <mesh ref={pulseRef} position={[0, -h * 0.75, 0]}>
        <sphereGeometry args={[w * 0.35, 16, 16]} />
        <meshStandardMaterial color="#cc4422" emissive="#881100" emissiveIntensity={0.4} roughness={0.7} transparent opacity={0.8} />
      </mesh>
      {/* Pus */}
      <mesh position={[w * 0.1, -h * 0.65, d * 0.1]}>
        <sphereGeometry args={[w * 0.1, 8, 8]} />
        <meshStandardMaterial color="#ddaa33" roughness={0.9} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/* ── COMPOSITE FILLING ───────────────────────────────────── */

function CompositeFillingOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#eee8da" roughness={0.3} clearcoat={0.4} />
      {/* Filling material — slightly different shade */}
      <mesh position={[0, h * 0.3, 0]}>
        <cylinderGeometry args={[w * 0.16, w * 0.2, 0.18, 16]} />
        <meshPhysicalMaterial color="#e8e0d0" roughness={0.2} metalness={0.02} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>
      {/* Polished top */}
      <mesh position={[0, h * 0.4, 0]}>
        <cylinderGeometry args={[w * 0.14, w * 0.14, 0.03, 16]} />
        <meshPhysicalMaterial color="#f2ece0" roughness={0.12} metalness={0.05} clearcoat={0.9} />
      </mesh>
    </group>
  );
}

/* ── ROOT CANAL TREATMENT ────────────────────────────────── */

function RCTOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#ddd6c8" roughness={0.4} clearcoat={0.2} />
      {/* Access cavity */}
      <mesh position={[0, h * 0.3, 0]}>
        <cylinderGeometry args={[w * 0.14, w * 0.18, 0.2, 16]} />
        <meshStandardMaterial color="#444" roughness={0.8} />
      </mesh>
      {/* Gutta percha fill */}
      <mesh position={[0, -h * 0.15, 0]}>
        <cylinderGeometry args={[0.05, 0.03, h * 0.55, 8]} />
        <meshStandardMaterial color="#e87040" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Core buildup */}
      <mesh position={[0, h * 0.18, 0]}>
        <cylinderGeometry args={[w * 0.12, w * 0.1, 0.25, 10]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

/* ── ZIRCONIA CROWN ──────────────────────────────────────── */

function CrownOverlay({ w, h, d, toothType }) {
  return (
    <group>
      {/* Prepared tooth stump */}
      <mesh position={[0, -h * 0.2, 0]} castShadow>
        <cylinderGeometry args={[w * 0.3, w * 0.28, h * 0.5, 12]} />
        <meshStandardMaterial color="#c8c0b0" roughness={0.5} />
      </mesh>

      {/* Crown — beautiful translucent shell */}
      <group position={[0, h * 0.1, 0]}>
        {/* Crown body */}
        <mesh castShadow>
          <cylinderGeometry args={[w * 0.46, w * 0.44, h * 0.5, 18, 1]} />
          <meshPhysicalMaterial
            color="#f5f2ed"
            roughness={0.12}
            metalness={0.0}
            clearcoat={0.95}
            clearcoatRoughness={0.04}
            transmission={0.1}
            thickness={0.5}
            ior={1.5}
          />
        </mesh>
        {/* Crown top cusps */}
        {toothType === 'molar' && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([cx, cz], i) => (
          <mesh key={i} position={[cx * w * 0.15, h * 0.28, cz * d * 0.15]} castShadow>
            <sphereGeometry args={[w * 0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshPhysicalMaterial color="#f5f2ed" roughness={0.12} clearcoat={0.95} />
          </mesh>
        ))}
        {toothType === 'premolar' && [[-1], [1]].map(([cz], i) => (
          <mesh key={i} position={[0, h * 0.28, cz * d * 0.12]} castShadow>
            <sphereGeometry args={[w * 0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshPhysicalMaterial color="#f5f2ed" roughness={0.12} clearcoat={0.95} />
          </mesh>
        ))}
        {(toothType === 'canine' || toothType === 'incisor') && (
          <mesh position={[0, h * 0.28, 0]} castShadow>
            <sphereGeometry args={[w * 0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <meshPhysicalMaterial color="#f5f2ed" roughness={0.12} clearcoat={0.95} />
          </mesh>
        )}
      </group>

      {/* Crown margin line */}
      <mesh position={[0, -h * 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[w * 0.44, 0.015, 8, 24]} />
        <meshStandardMaterial color="#bbb" roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
}

/* ── EXTRACTION SOCKET ───────────────────────────────────── */

function ExtractionSocket({ w, d }) {
  return (
    <group>
      {/* Socket hole */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[w * 0.3, w * 0.2, 0.7, 16]} />
        <meshStandardMaterial color="#c4616a" roughness={0.9} />
      </mesh>
      {/* Blood clot at base */}
      <mesh position={[0, -0.5, 0]}>
        <sphereGeometry args={[w * 0.18, 12, 12]} />
        <meshStandardMaterial color="#8b3040" roughness={0.95} />
      </mesh>
      {/* Surrounding gingiva ridge */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[w * 0.35, 0.08, 8, 16]} />
        <meshStandardMaterial color="#d4827a" roughness={0.85} />
      </mesh>
    </group>
  );
}
