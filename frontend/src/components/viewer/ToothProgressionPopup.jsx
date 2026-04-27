import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* ──────────────────────────────────────────────────────────────────────
   ToothProgressionPopup — 3D simulation that pops next to a tooth and
   animates the disease → treatment progression for that tooth.

   Root anatomy is generated from the FDI number so molars get the right
   number of roots (upper molars = 3, lower molars = 2, upper-4 = 2,
   anteriors / most premolars = 1).

   Phases:
     DISEASE: Healthy → Enamel → Dentin → Deep Dentin → Pulpitis →
              Canal Infection → Periapical Abscess
     TREATMENT: Access → Clean & Shape → Gutta-Percha Fill → Crown
─────────────────────────────────────────────────────────────────────── */

export function getToothAnatomy(fdi) {
  if (!fdi) return null;
  const fdiStr = String(fdi);
  const arch = fdiStr[0];
  const pos = parseInt(fdiStr[1], 10);
  const isUpper = arch === '1' || arch === '2';

  // Anteriors — central, lateral incisors (1 root)
  if (pos <= 2) {
    return {
      type: 'incisor',
      crownW: 2.0, crownD: 1.4, crownH: 5.5,
      roots: [{ x: 0, z: 0, length: 11, topR: 0.95, bottomR: 0.22 }],
    };
  }
  // Canine (1 long root)
  if (pos === 3) {
    return {
      type: 'canine',
      crownW: 2.0, crownD: 1.7, crownH: 6,
      roots: [{ x: 0, z: 0, length: 14, topR: 1.0, bottomR: 0.28 }],
    };
  }
  // First premolar — upper has 2 roots, lower has 1
  if (pos === 4) {
    if (isUpper) {
      return {
        type: 'premolar',
        crownW: 2.6, crownD: 2.4, crownH: 5,
        roots: [
          { x: -0.95, z: 0, length: 10, topR: 0.65, bottomR: 0.2 },
          { x:  0.95, z: 0, length: 10, topR: 0.65, bottomR: 0.2 },
        ],
      };
    }
    return {
      type: 'premolar',
      crownW: 2.6, crownD: 2.4, crownH: 5,
      roots: [{ x: 0, z: 0, length: 11, topR: 1.0, bottomR: 0.26 }],
    };
  }
  // Second premolar — 1 root
  if (pos === 5) {
    return {
      type: 'premolar',
      crownW: 2.6, crownD: 2.4, crownH: 5,
      roots: [{ x: 0, z: 0, length: 11, topR: 1.0, bottomR: 0.26 }],
    };
  }
  // Molars
  if (isUpper) {
    // Upper molar — 3 roots (MB, DB, palatal)
    return {
      type: 'molar',
      crownW: 3.4, crownD: 3.4, crownH: 4.5,
      roots: [
        { x: -1.2, z: -1.0, length: 10, topR: 0.6, bottomR: 0.2 },  // mesiobuccal
        { x: -1.2, z:  1.0, length: 10, topR: 0.6, bottomR: 0.2 },  // distobuccal
        { x:  1.4, z:  0,   length: 11, topR: 0.7, bottomR: 0.22 }, // palatal (longer)
      ],
    };
  }
  // Lower molar — 2 roots (mesial, distal)
  return {
    type: 'molar',
    crownW: 3.6, crownD: 2.8, crownH: 4.5,
    roots: [
      { x: -1.5, z: 0, length: 11, topR: 0.85, bottomR: 0.24 }, // mesial
      { x:  1.5, z: 0, length: 10, topR: 0.85, bottomR: 0.24 }, // distal
    ],
  };
}

const PHASES = [
  { id: 'healthy',        label: 'Healthy Tooth',           detail: 'Intact enamel, vital pulp, healthy supporting bone.', stage: 'disease' },
  { id: 'enamel',         label: 'Enamel Caries',           detail: 'Surface demineralization. Reversible if caught early.', stage: 'disease' },
  { id: 'dentin',         label: 'Dentin Caries',           detail: 'Decay penetrates dentin. A filling is needed.', stage: 'disease' },
  { id: 'deep',           label: 'Deep Dentinal Caries',    detail: 'Decay nears the pulp. Sensitivity to cold/sweet appears.', stage: 'disease' },
  { id: 'pulpitis',       label: 'Irreversible Pulpitis',   detail: 'Bacteria reach the pulp chamber. Severe pain, tooth vitality lost.', stage: 'disease' },
  { id: 'canalInfection', label: 'Root Canal Infection',    detail: 'Infection descends through the root canal system.', stage: 'disease' },
  { id: 'periapex',       label: 'Periapical Abscess',      detail: 'Infection breaches the apex. Bone destruction begins around the root tip.', stage: 'disease' },
  { id: 'access',         label: 'Endodontic Access',       detail: 'Access cavity drilled. Necrotic pulp tissue removed.', stage: 'treatment' },
  { id: 'shape',          label: 'Cleaning & Shaping',      detail: 'Endo files clean and shape each canal to working length.', stage: 'treatment' },
  { id: 'obturate',       label: 'Gutta-Percha Obturation', detail: 'Canals sealed three-dimensionally with gutta-percha + sealer.', stage: 'treatment' },
  { id: 'crown',          label: 'Permanent Crown',         detail: 'Tooth restored with full-coverage crown — function & aesthetics restored.', stage: 'treatment' },
];

function phaseDataForId(id) {
  const all = {
    healthy:        { caries: 0,    cariesDepth: 0,    pulpColor: '#f7c0a8', pulpEmissive: 0.05, canalState: 'healthy', apicalLesion: 0,   accessHole: false, fileDepth: 0, gutta: 0, crownCap: false },
    enamel:         { caries: 0.3,  cariesDepth: 0.15, pulpColor: '#f7c0a8', pulpEmissive: 0.05, canalState: 'healthy', apicalLesion: 0,   accessHole: false, fileDepth: 0, gutta: 0, crownCap: false },
    dentin:         { caries: 0.55, cariesDepth: 0.45, pulpColor: '#f7c0a8', pulpEmissive: 0.05, canalState: 'healthy', apicalLesion: 0,   accessHole: false, fileDepth: 0, gutta: 0, crownCap: false },
    deep:           { caries: 0.8,  cariesDepth: 0.85, pulpColor: '#e07050', pulpEmissive: 0.15, canalState: 'healthy', apicalLesion: 0,   accessHole: false, fileDepth: 0, gutta: 0, crownCap: false },
    pulpitis:       { caries: 0.9,  cariesDepth: 1.0,  pulpColor: '#cc1818', pulpEmissive: 0.5,  canalState: 'partial', apicalLesion: 0.1, accessHole: false, fileDepth: 0, gutta: 0, crownCap: false },
    canalInfection: { caries: 0.9,  cariesDepth: 1.0,  pulpColor: '#8a0a0a', pulpEmissive: 0.4,  canalState: 'infected',apicalLesion: 0.4, accessHole: false, fileDepth: 0, gutta: 0, crownCap: false },
    periapex:       { caries: 0.9,  cariesDepth: 1.0,  pulpColor: '#5a0404', pulpEmissive: 0.3,  canalState: 'infected',apicalLesion: 1.0, accessHole: false, fileDepth: 0, gutta: 0, crownCap: false },
    access:         { caries: 0.9,  cariesDepth: 1.0,  pulpColor: '#888888', pulpEmissive: 0,    canalState: 'infected',apicalLesion: 0.9, accessHole: true,  fileDepth: 0.15, gutta: 0, crownCap: false },
    shape:          { caries: 0.9,  cariesDepth: 1.0,  pulpColor: '#cccccc', pulpEmissive: 0,    canalState: 'shaped',  apicalLesion: 0.6, accessHole: true,  fileDepth: 1.0, gutta: 0, crownCap: false },
    obturate:       { caries: 0.9,  cariesDepth: 1.0,  pulpColor: '#dd7a40', pulpEmissive: 0.05, canalState: 'gutta',   apicalLesion: 0.3, accessHole: true,  fileDepth: 0,   gutta: 1, crownCap: false },
    crown:          { caries: 0,    cariesDepth: 0,    pulpColor: '#dd7a40', pulpEmissive: 0,    canalState: 'gutta',   apicalLesion: 0.05,accessHole: false, fileDepth: 0,   gutta: 1, crownCap: true  },
  };
  return all[id] || all.healthy;
}

function canalColor(state) {
  switch (state) {
    case 'infected': return '#5a0a08';
    case 'partial':  return '#a0382a';
    case 'shaped':   return '#e8e0d0';
    case 'gutta':    return '#cc6a28';
    default:         return '#f5dab5'; // healthy pulp tissue
  }
}

function ToothModel({ anatomy, phaseData }) {
  const maxRoot = Math.max(...anatomy.roots.map((r) => r.length));
  const cementoEnamelY = 0;
  const crownTopY = anatomy.crownH;
  const apexY = -maxRoot;

  return (
    <group position={[0, -(crownTopY + apexY) / 2, 0]}>
      {/* Alveolar bone — translucent block tooth sits in */}
      <mesh position={[0, -maxRoot * 0.5, 0]}>
        <boxGeometry args={[Math.max(anatomy.crownW * 2.6, 9), maxRoot, Math.max(anatomy.crownD * 2.6, 6)]} />
        <meshStandardMaterial color="#e8d8b8" transparent opacity={0.18} roughness={0.95} depthWrite={false} />
      </mesh>

      {/* Periodontal ligament — thin pink layer hugging each root */}
      {anatomy.roots.map((r, i) => (
        <mesh key={`pdl-${i}`} position={[r.x, -r.length * 0.5, r.z || 0]}>
          <cylinderGeometry args={[r.topR * 1.18, r.bottomR * 1.18, r.length, 16]} />
          <meshStandardMaterial color="#d49080" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      ))}

      {/* Crown — translucent enamel so internals show */}
      {!phaseData.crownCap && (
        <mesh position={[0, anatomy.crownH * 0.5, 0]}>
          <boxGeometry args={[anatomy.crownW, anatomy.crownH, anatomy.crownD]} />
          <meshPhysicalMaterial
            color="#fff5e0"
            transparent
            opacity={0.32}
            roughness={0.25}
            transmission={0.5}
            ior={1.55}
            thickness={0.4}
            clearcoat={0.6}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Crown restoration — full-coverage opaque cap */}
      {phaseData.crownCap && (
        <mesh position={[0, anatomy.crownH * 0.5, 0]}>
          <boxGeometry args={[anatomy.crownW * 1.04, anatomy.crownH * 1.02, anatomy.crownD * 1.04]} />
          <meshPhysicalMaterial color="#f8f0e0" roughness={0.15} clearcoat={1} clearcoatRoughness={0.05} reflectivity={0.6} metalness={0} />
        </mesh>
      )}

      {/* Pulp chamber — inside crown */}
      <mesh position={[0, anatomy.crownH * 0.4, 0]}>
        <boxGeometry args={[anatomy.crownW * 0.42, anatomy.crownH * 0.55, anatomy.crownD * 0.42]} />
        <meshStandardMaterial
          color={phaseData.pulpColor}
          emissive={phaseData.pulpColor}
          emissiveIntensity={phaseData.pulpEmissive}
          transparent
          opacity={phaseData.accessHole ? 0.25 : 0.95}
          depthWrite={!phaseData.accessHole}
        />
      </mesh>

      {/* Access opening — black hole drilled through occlusal into chamber */}
      {phaseData.accessHole && (
        <mesh position={[0, anatomy.crownH * 0.55, 0]}>
          <cylinderGeometry args={[anatomy.crownW * 0.18, anatomy.crownW * 0.16, anatomy.crownH * 1.05, 24]} />
          <meshStandardMaterial color="#000" />
        </mesh>
      )}

      {/* Roots + canals + periapical lesions + endo files */}
      {anatomy.roots.map((r, i) => {
        const rootCenterY = -r.length * 0.5;
        const apex = -r.length;
        return (
          <group key={`root-${i}`}>
            {/* Root cone */}
            <mesh position={[r.x, rootCenterY, r.z || 0]}>
              <cylinderGeometry args={[r.topR, r.bottomR, r.length, 18]} />
              <meshPhysicalMaterial
                color="#f0dfb8"
                transparent
                opacity={0.28}
                roughness={0.4}
                transmission={0.4}
                ior={1.45}
                depthWrite={false}
              />
            </mesh>

            {/* Root canal — colored cylinder running through root */}
            <mesh position={[r.x, rootCenterY, r.z || 0]}>
              <cylinderGeometry args={[r.topR * 0.22, r.bottomR * 0.55, r.length * 0.97, 14]} />
              <meshStandardMaterial
                color={canalColor(phaseData.canalState)}
                emissive={phaseData.canalState === 'infected' ? '#3a0000' : '#000'}
                emissiveIntensity={phaseData.canalState === 'infected' ? 0.4 : 0}
                roughness={phaseData.canalState === 'gutta' ? 0.5 : 0.7}
              />
            </mesh>

            {/* Periapical lesion — dark inflammation blob at root tip */}
            {phaseData.apicalLesion > 0.05 && (
              <mesh position={[r.x, apex - 0.4, r.z || 0]}>
                <sphereGeometry args={[0.55 + phaseData.apicalLesion * 0.7, 16, 12]} />
                <meshStandardMaterial
                  color={phaseData.apicalLesion > 0.6 ? '#5a1a08' : '#7a3a18'}
                  emissive="#3a0c04"
                  emissiveIntensity={phaseData.apicalLesion * 0.3}
                  transparent
                  opacity={0.85}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* Endo file — silver instrument going down canal during shaping */}
            {phaseData.fileDepth > 0 && (
              <mesh position={[r.x, anatomy.crownH * 0.5 - r.length * phaseData.fileDepth * 0.5, r.z || 0]}>
                <cylinderGeometry args={[0.08, 0.04, anatomy.crownH + r.length * phaseData.fileDepth, 8]} />
                <meshStandardMaterial color="#d8d8e0" metalness={0.85} roughness={0.18} />
              </mesh>
            )}

            {/* Gutta-percha cone — orange filling, slightly visible inside the canal cylinder */}
            {phaseData.gutta > 0 && (
              <mesh position={[r.x, rootCenterY, r.z || 0]}>
                <coneGeometry args={[r.topR * 0.2, r.length * 0.97, 14]} />
                <meshStandardMaterial color="#c95818" roughness={0.6} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Caries lesion — dark stain on occlusal surface + decay penetrating crown */}
      {phaseData.caries > 0 && !phaseData.crownCap && (
        <group position={[0, anatomy.crownH, 0]}>
          {/* Surface stain disc */}
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[anatomy.crownW * 0.42 * phaseData.caries, 28]} />
            <meshStandardMaterial color="#1a0a04" transparent opacity={0.92} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* Decay cone descending into crown */}
          <mesh position={[0, -anatomy.crownH * 0.5 * phaseData.cariesDepth, 0]}>
            <coneGeometry args={[anatomy.crownW * 0.38 * phaseData.caries, anatomy.crownH * phaseData.cariesDepth, 22, 1, true]} />
            <meshStandardMaterial color="#0a0301" side={THREE.DoubleSide} roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function SlowSpin({ children }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.0035;
  });
  return <group ref={ref}>{children}</group>;
}

function btnStyle(primary = false) {
  return {
    flex: 1,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: primary ? '#0a0a0a' : '#d1d5db',
    background: primary ? '#fff' : 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.15s',
  };
}

export default function ToothProgressionPopup({ tooth, pathology, onClose }) {
  const anatomy = useMemo(() => getToothAnatomy(tooth), [tooth]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Start animation at the phase matching the input depth
  useEffect(() => {
    const startMap = {
      incipient: 1, enamel: 1,
      dentin: 2, deep_dentin: 3,
      pulp_exposure: 4,
    };
    setPhaseIdx(startMap[pathology?.depth] ?? 0);
    setPlaying(true);
  }, [pathology?.depth, pathology?.kind, tooth]);

  // Auto-advance phases, stop at the last one
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setPhaseIdx((p) => {
        if (p >= PHASES.length - 1) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, 2400);
    return () => clearInterval(t);
  }, [playing]);

  if (!anatomy) return null;

  const current = PHASES[phaseIdx];
  const phaseData = phaseDataForId(current.id);
  const isDisease = current.stage === 'disease';
  const accent = isDisease ? '#ef4444' : '#10b981';
  const accentDim = isDisease ? '#7f1d1d' : '#065f46';

  return (
    <div
      style={{
        width: 460,
        background: 'rgba(12,12,18,0.97)',
        border: `1.5px solid ${accent}55`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: `0 22px 60px rgba(0,0,0,0.75), 0 0 32px ${accent}33`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: isDisease ? 'rgba(220,38,38,0.08)' : 'rgba(16,185,129,0.08)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Tooth #{tooth} · {anatomy.type} · {anatomy.roots.length} root{anatomy.roots.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{current.label}</span>
            <span
              style={{
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                background: isDisease ? 'rgba(220,38,38,0.2)' : 'rgba(16,185,129,0.2)',
                color: isDisease ? '#fca5a5' : '#6ee7b7',
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {current.stage}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 0,
            color: '#9ca3af',
            fontSize: 24,
            cursor: 'pointer',
            lineHeight: 1,
            padding: 0,
            marginLeft: 8,
          }}
          aria-label="Close progression simulation"
        >
          ×
        </button>
      </div>

      {/* 3D simulation */}
      <div style={{ height: 280, background: 'radial-gradient(ellipse at center, #1a1a28 0%, #050508 100%)' }}>
        <Canvas camera={{ position: [0, 4, 28], fov: 32 }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 12, 8]} intensity={1.3} />
          <directionalLight position={[-6, 6, -5]} intensity={0.45} color="#aaccff" />
          <pointLight position={[0, -10, 6]} intensity={0.4} color="#ff8866" />
          <SlowSpin>
            <ToothModel anatomy={anatomy} phaseData={phaseData} />
          </SlowSpin>
          <OrbitControls enableZoom enablePan={false} minDistance={16} maxDistance={48} maxPolarAngle={Math.PI * 0.9} />
        </Canvas>
      </div>

      {/* Caption + controls */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.45, marginBottom: 9, minHeight: 34 }}>
          {current.detail}
        </div>

        {/* Phase scrubber */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 9 }}>
          {PHASES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                setPhaseIdx(i);
                setPlaying(false);
              }}
              title={p.label}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                border: 0,
                cursor: 'pointer',
                padding: 0,
                background:
                  i === phaseIdx
                    ? p.stage === 'disease' ? '#ef4444' : '#10b981'
                    : i < phaseIdx
                      ? p.stage === 'disease' ? accentDim : '#065f46'
                      : 'rgba(255,255,255,0.1)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Play controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => { setPhaseIdx(0); setPlaying(true); }} style={btnStyle()}>↺ Replay</button>
          <button onClick={() => setPlaying((p) => !p)} style={btnStyle(true)}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
          <button
            onClick={() => setPhaseIdx((i) => Math.min(PHASES.length - 1, i + 1))}
            style={btnStyle()}
          >
            Next ›
          </button>
        </div>

        <div style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 7, letterSpacing: 0.6 }}>
          STEP {phaseIdx + 1} OF {PHASES.length}
        </div>
      </div>
    </div>
  );
}
