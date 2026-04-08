import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ToothOverlay — renders disease/treatment state on a specific tooth.
 * Uses LatheGeometry for smooth, organic tooth shapes.
 */
export default function ToothOverlay({ state, module, toothNumber, toothSize }) {
  const [w, h, d] = toothSize || [0.9, 1.1, 0.7];
  const stage = state?.clinical_metrics?.stage || 'initial';
  const treatment = state?.clinical_metrics?.treatment || '';
  const toothType = getToothType(toothNumber);

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

/* ── LATHE PROFILES — organic tooth cross-sections ───────── */

function createMolarProfile(w, h) {
  const points = [
    new THREE.Vector2(0, -h * 0.8),       // root tip
    new THREE.Vector2(w * 0.12, -h * 0.7),
    new THREE.Vector2(w * 0.18, -h * 0.5),
    new THREE.Vector2(w * 0.15, -h * 0.35), // cervical constriction
    new THREE.Vector2(w * 0.35, -h * 0.15), // crown flare
    new THREE.Vector2(w * 0.42, 0),         // widest point
    new THREE.Vector2(w * 0.44, h * 0.1),
    new THREE.Vector2(w * 0.4, h * 0.2),    // start cusps
    new THREE.Vector2(w * 0.32, h * 0.28),  // fissure dip
    new THREE.Vector2(w * 0.38, h * 0.35),  // cusp peak
    new THREE.Vector2(w * 0.2, h * 0.3),    // central fossa
    new THREE.Vector2(0, h * 0.28),          // center
  ];
  return points;
}

function createPremolarProfile(w, h) {
  return [
    new THREE.Vector2(0, -h * 0.85),
    new THREE.Vector2(w * 0.1, -h * 0.7),
    new THREE.Vector2(w * 0.14, -h * 0.45),
    new THREE.Vector2(w * 0.12, -h * 0.3),
    new THREE.Vector2(w * 0.3, -h * 0.1),
    new THREE.Vector2(w * 0.35, 0),
    new THREE.Vector2(w * 0.36, h * 0.1),
    new THREE.Vector2(w * 0.33, h * 0.25),
    new THREE.Vector2(w * 0.28, h * 0.32),
    new THREE.Vector2(w * 0.35, h * 0.4),
    new THREE.Vector2(w * 0.15, h * 0.38),
    new THREE.Vector2(0, h * 0.36),
  ];
}

function createCanineProfile(w, h) {
  return [
    new THREE.Vector2(0, -h * 0.9),
    new THREE.Vector2(w * 0.08, -h * 0.75),
    new THREE.Vector2(w * 0.12, -h * 0.5),
    new THREE.Vector2(w * 0.1, -h * 0.3),
    new THREE.Vector2(w * 0.26, -h * 0.1),
    new THREE.Vector2(w * 0.3, 0),
    new THREE.Vector2(w * 0.32, h * 0.1),
    new THREE.Vector2(w * 0.28, h * 0.25),
    new THREE.Vector2(w * 0.2, h * 0.4),
    new THREE.Vector2(w * 0.1, h * 0.5),
    new THREE.Vector2(0, h * 0.55),          // pointed cusp tip
  ];
}

function createIncisorProfile(w, h) {
  return [
    new THREE.Vector2(0, -h * 0.85),
    new THREE.Vector2(w * 0.07, -h * 0.7),
    new THREE.Vector2(w * 0.1, -h * 0.45),
    new THREE.Vector2(w * 0.08, -h * 0.25),
    new THREE.Vector2(w * 0.22, -h * 0.05),
    new THREE.Vector2(w * 0.28, h * 0.05),
    new THREE.Vector2(w * 0.3, h * 0.15),
    new THREE.Vector2(w * 0.28, h * 0.3),
    new THREE.Vector2(w * 0.2, h * 0.4),
    new THREE.Vector2(w * 0.12, h * 0.45),   // incisal edge
    new THREE.Vector2(0, h * 0.46),
  ];
}

function getProfile(toothType, w, h) {
  switch (toothType) {
    case 'molar': return createMolarProfile(w, h);
    case 'premolar': return createPremolarProfile(w, h);
    case 'canine': return createCanineProfile(w, h);
    default: return createIncisorProfile(w, h);
  }
}

/* ── REALISTIC TOOTH BASE — LatheGeometry ─────────────────── */

export function RealisticTooth({ w, h, d, toothType, color = '#f0ece4', roughness = 0.25, clearcoat = 0.6, emissive, emissiveIntensity = 0 }) {
  const geometry = useMemo(() => {
    const profile = getProfile(toothType, w, h);
    const curve = new THREE.CatmullRomCurve3(
      profile.map(p => new THREE.Vector3(p.x, p.y, 0)),
      false, 'catmullrom', 0.5
    );
    const smoothPoints = curve.getPoints(40).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
    const geo = new THREE.LatheGeometry(smoothPoints, 24);
    // Slightly squash to make less perfectly round (more tooth-like)
    const scaleX = toothType === 'incisor' ? 1.4 : toothType === 'canine' ? 1.1 : 1.0;
    const scaleZ = toothType === 'incisor' ? 0.6 : toothType === 'canine' ? 0.8 : (toothType === 'premolar' ? 0.85 : 0.95);
    geo.scale(scaleX, 1, scaleZ);
    geo.computeVertexNormals();
    return geo;
  }, [toothType, w, h]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={color}
        roughness={roughness}
        metalness={0.02}
        clearcoat={clearcoat}
        clearcoatRoughness={0.12}
        {...(emissive ? { emissive, emissiveIntensity } : {})}
      />
    </mesh>
  );
}

/* ── ENAMEL CARIES — small brown lesion ──────────────────── */

function EnamelCariesOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#ede8dc" roughness={0.35} clearcoat={0.3} />
      <mesh position={[0, h * 0.3, w * 0.15]}>
        <sphereGeometry args={[w * 0.12, 16, 16]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      <mesh position={[0, h * 0.28, w * 0.12]} rotation={[-0.3, 0, 0]}>
        <ringGeometry args={[w * 0.08, w * 0.18, 20]} />
        <meshStandardMaterial color="#a07828" roughness={0.85} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── DENTIN CARIES — deeper cavity ──────────────────────── */

function DentinCariesOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#e5ddd0" roughness={0.4} clearcoat={0.2} />
      <mesh position={[0, h * 0.25, 0]}>
        <sphereGeometry args={[w * 0.18, 16, 16]} />
        <meshStandardMaterial color="#5C3310" roughness={0.95} />
      </mesh>
      <mesh position={[0, h * 0.15, 0]}>
        <sphereGeometry args={[w * 0.12, 12, 12]} />
        <meshStandardMaterial color="#3a1f08" roughness={1.0} />
      </mesh>
      <mesh position={[0, h * 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[w * 0.14, w * 0.26, 20]} />
        <meshStandardMaterial color="#c4a35a" roughness={0.8} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── PULPITIS — pulsing red inflammation ─────────────────── */

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
      <mesh position={[0, h * 0.2, 0]}>
        <sphereGeometry args={[w * 0.16, 16, 16]} />
        <meshStandardMaterial color="#3a1f08" roughness={0.95} />
      </mesh>
      <mesh ref={pulseRef} position={[0, -h * 0.1, 0]}>
        <sphereGeometry args={[w * 0.2, 20, 20]} />
        <meshStandardMaterial color="#cc1a1a" emissive="#cc1a1a" emissiveIntensity={0.8} roughness={0.6} transparent opacity={0.85} />
      </mesh>
      {[0, 72, 144, 216, 288].map((angle) => (
        <mesh key={angle} position={[
          Math.cos(angle * Math.PI / 180) * w * 0.4,
          h * 0.05,
          Math.sin(angle * Math.PI / 180) * w * 0.4
        ]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.5} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/* ── ABSCESS — periapical swelling ──────────────────────── */

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
      <mesh position={[0, h * 0.2, 0]}>
        <sphereGeometry args={[w * 0.17, 16, 16]} />
        <meshStandardMaterial color="#2a1505" roughness={1.0} />
      </mesh>
      <mesh position={[0, -h * 0.1, 0]}>
        <sphereGeometry args={[w * 0.14, 12, 12]} />
        <meshStandardMaterial color="#555" roughness={0.9} />
      </mesh>
      <mesh ref={pulseRef} position={[0, -h * 0.7, 0]}>
        <sphereGeometry args={[w * 0.4, 20, 20]} />
        <meshStandardMaterial color="#cc4422" emissive="#881100" emissiveIntensity={0.4} roughness={0.7} transparent opacity={0.8} />
      </mesh>
      <mesh position={[w * 0.1, -h * 0.6, d * 0.1]}>
        <sphereGeometry args={[w * 0.1, 10, 10]} />
        <meshStandardMaterial color="#ddaa33" roughness={0.9} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/* ── COMPOSITE FILLING ──────────────────────────────────── */

function CompositeFillingOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#eee8da" roughness={0.28} clearcoat={0.5} />
      <mesh position={[0, h * 0.25, 0]}>
        <sphereGeometry args={[w * 0.16, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshPhysicalMaterial color="#e8e0d0" roughness={0.15} metalness={0.02} clearcoat={0.7} clearcoatRoughness={0.06} />
      </mesh>
      <mesh position={[0, h * 0.33, 0]}>
        <sphereGeometry args={[w * 0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        <meshPhysicalMaterial color="#f2ece0" roughness={0.1} metalness={0.04} clearcoat={0.9} />
      </mesh>
    </group>
  );
}

/* ── ROOT CANAL TREATMENT ───────────────────────────────── */

function RCTOverlay({ w, h, d, toothType }) {
  return (
    <group>
      <RealisticTooth w={w} h={h} d={d} toothType={toothType} color="#ddd6c8" roughness={0.4} clearcoat={0.2} />
      <mesh position={[0, h * 0.25, 0]}>
        <cylinderGeometry args={[w * 0.12, w * 0.14, 0.2, 20]} />
        <meshStandardMaterial color="#444" roughness={0.8} />
      </mesh>
      <mesh position={[0, -h * 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.025, h * 0.6, 10]} />
        <meshStandardMaterial color="#e87040" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, h * 0.12, 0]}>
        <cylinderGeometry args={[w * 0.1, w * 0.08, 0.22, 12]} />
        <meshStandardMaterial color="#c0c0c0" roughness={0.35} metalness={0.35} />
      </mesh>
    </group>
  );
}

/* ── ZIRCONIA CROWN ─────────────────────────────────────── */

function CrownOverlay({ w, h, d, toothType }) {
  const crownGeo = useMemo(() => {
    const profile = getProfile(toothType, w, h);
    // Only use the crown portion (above cervical line)
    const crownPoints = profile.filter(p => p.y > -h * 0.15);
    if (crownPoints.length < 3) return null;
    // Scale up slightly for crown
    const scaled = crownPoints.map(p => new THREE.Vector2(p.x * 1.05, p.y));
    const curve = new THREE.CatmullRomCurve3(
      scaled.map(p => new THREE.Vector3(Math.max(0, p.x), p.y, 0)),
      false, 'catmullrom', 0.5
    );
    const smooth = curve.getPoints(30).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
    const geo = new THREE.LatheGeometry(smooth, 28);
    const scaleX = toothType === 'incisor' ? 1.35 : toothType === 'canine' ? 1.1 : 1.0;
    const scaleZ = toothType === 'incisor' ? 0.65 : toothType === 'canine' ? 0.82 : 0.95;
    geo.scale(scaleX, 1, scaleZ);
    geo.computeVertexNormals();
    return geo;
  }, [toothType, w, h]);

  return (
    <group>
      {/* Prepared tooth stump */}
      <mesh position={[0, -h * 0.25, 0]} castShadow>
        <cylinderGeometry args={[w * 0.25, w * 0.22, h * 0.5, 16]} />
        <meshStandardMaterial color="#c8c0b0" roughness={0.5} />
      </mesh>

      {/* Crown — translucent zirconia */}
      {crownGeo && (
        <mesh geometry={crownGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#f5f2ed"
            roughness={0.08}
            metalness={0.0}
            clearcoat={1.0}
            clearcoatRoughness={0.03}
            transmission={0.12}
            thickness={0.5}
            ior={1.52}
          />
        </mesh>
      )}

      {/* Crown margin line */}
      <mesh position={[0, -h * 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[w * 0.4, 0.012, 8, 28]} />
        <meshStandardMaterial color="#bbb" roughness={0.25} metalness={0.45} />
      </mesh>
    </group>
  );
}

/* ── EXTRACTION SOCKET ──────────────────────────────────── */

function ExtractionSocket({ w, d }) {
  return (
    <group>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[w * 0.28, w * 0.18, 0.7, 20]} />
        <meshStandardMaterial color="#c4616a" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <sphereGeometry args={[w * 0.16, 14, 14]} />
        <meshStandardMaterial color="#8b3040" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[w * 0.32, 0.07, 10, 20]} />
        <meshStandardMaterial color="#d4827a" roughness={0.85} />
      </mesh>
    </group>
  );
}
