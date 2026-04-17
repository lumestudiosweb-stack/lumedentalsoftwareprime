import { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { toothName } from './ToothPicker';

/**
 * ToothAnatomyPanel — side panel that shows the picked tooth as a
 * full 3D model with the surrounding periodontium AND a half-cutaway
 * view that exposes the internal layers:
 *
 *   • Enamel (translucent off-white outer shell)
 *   • Dentin (yellow-cream layer underneath)
 *   • Pulp chamber + root canals (red soft tissue)
 *   • Cementum (root surface)
 *   • PDL ring (periodontal ligament)
 *   • Alveolar bone socket
 *   • Gingiva collar
 *
 * On top of this anatomical model the dentist's chosen pathology
 * (Black's class + surface(s) + depth + kind) is rendered at the
 * anatomically correct landmark — e.g. central groove for Class I O,
 * mesial marginal ridge for Class II MO, cervical third buccal for
 * Class V B, etc.
 */
export default function ToothAnatomyPanel({ fdi, pathology, onClose }) {
  if (!fdi) return null;

  const morphology = useMemo(() => getToothMorphology(fdi), [fdi]);

  return (
    <div className="bg-surface-1 border border-white/5 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-black/40 px-3 py-2 border-b border-white/5 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider">Tooth Anatomy</div>
          <div className="text-sm font-display font-semibold text-white">
            #{fdi} <span className="text-gray-400 font-normal">— {toothName(fdi)}</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs px-2">
            ✕
          </button>
        )}
      </div>

      {/* 3D Viewer */}
      <div className="h-72 bg-gradient-to-b from-[#0a0a14] to-[#000]">
        <Canvas
          camera={{ position: [0, 1, 8], fov: 38 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, localClippingEnabled: true }}
          onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 6, 6]} intensity={1.4} />
          <directionalLight position={[-4, 3, -4]} intensity={0.5} color="#aaccff" />
          <pointLight position={[0, -3, 4]} intensity={0.4} color="#ffeedd" />
          <Suspense fallback={null}>
            <ToothScene morphology={morphology} pathology={pathology} fdi={fdi} />
            <Environment preset="studio" environmentIntensity={0.45} />
          </Suspense>
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            minDistance={4}
            maxDistance={14}
            autoRotate={!pathology?.kind}
            autoRotateSpeed={0.7}
          />
        </Canvas>
      </div>

      {/* Legend / clinical note */}
      <div className="p-3 space-y-1.5 text-[10px]">
        <LegendRow color="#f5ecd8" label="Enamel" />
        <LegendRow color="#e6c98a" label="Dentin" />
        <LegendRow color="#cc4444" label="Pulp" />
        <LegendRow color="#d4b890" label="Cementum" />
        <LegendRow color="#cc6677" label="Gingiva" />
        <LegendRow color="#e8d8b8" label="Alveolar Bone" />
        <LegendRow color="#a0a098" label="Periodontal Ligament" />
      </div>

      {/* Pathology summary */}
      {pathology?.kind && (
        <div className="px-3 pb-3">
          <div className="bg-black/40 border border-white/5 rounded-md p-2.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Diagnosis / Plan
            </div>
            <div className="text-xs text-white font-medium">
              {pathologyHumanLabel(pathology, fdi)}
            </div>
            {pathology.depth && (
              <div className="text-[10px] text-gray-500 mt-1">
                Depth: <span className="text-gray-300 capitalize">{pathology.depth.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color, boxShadow: `0 0 6px ${color}55` }} />
      <span className="text-gray-400">{label}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   3D scene: full anatomy with optional half-cutaway and lesion overlay
─────────────────────────────────────────────────────────── */
function ToothScene({ morphology, pathology, fdi }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // gentle bob if nothing picked
    if (!pathology?.kind) {
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.05;
    }
  });

  // Whether to render in cutaway mode (when a pathology requires showing depth)
  const cutaway = !!pathology?.kind && pathology.kind !== 'sealant';

  return (
    <group ref={groupRef}>
      {/* Alveolar bone socket — always visible, sits below */}
      <mesh position={[0, -2.4, 0]}>
        <cylinderGeometry args={[1.3, 1.4, 1.6, 32]} />
        <meshStandardMaterial color="#e8d8b8" roughness={0.95} />
      </mesh>

      {/* Gingiva — pink collar around the cervical area */}
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[1.15, 1.25, 0.7, 32]} />
        <meshPhysicalMaterial color="#cc6677" roughness={0.7} clearcoat={0.3} clearcoatRoughness={0.5} />
      </mesh>

      {/* Periodontal ligament — thin grey ring around the root */}
      <mesh position={[0, -2.0, 0]}>
        <cylinderGeometry args={[1.02, 1.08, 1.3, 32]} />
        <meshStandardMaterial color="#a0a098" roughness={0.9} transparent opacity={0.85} />
      </mesh>

      {/* The tooth itself — anatomical layers */}
      <ToothAnatomy morphology={morphology} cutaway={cutaway} pathology={pathology} fdi={fdi} />

      {/* Floating tooth-number label */}
      <Html position={[0, 2.6, 0]} center distanceFactor={6}>
        <div className="bg-black/70 text-white text-[10px] px-2 py-0.5 rounded border border-white/10 pointer-events-none">
          #{fdi}
        </div>
      </Html>
    </group>
  );
}

/* ──────────────────────────────────────────────────────────
   Layered tooth — enamel + dentin + pulp, with a cutaway plane
   that hides the +X half of each layer when cutaway===true.
─────────────────────────────────────────────────────────── */
function ToothAnatomy({ morphology, cutaway, pathology, fdi }) {
  // Position landmarks relative to the tooth — used for placing lesion overlay.
  const landmark = useMemo(
    () => surfacesToLandmark(pathology?.surfaces || [], pathology?.classification, morphology),
    [pathology?.surfaces, pathology?.classification, morphology]
  );

  // Clip planes for cutaway — clip away the +X side
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);

  return (
    <group>
      {/* Crown enamel — translucent shell */}
      <mesh position={[0, morphology.crownY, 0]}>
        {morphology.crownGeo}
        <meshPhysicalMaterial
          color="#f5ecd8"
          roughness={0.18}
          metalness={0.02}
          clearcoat={1}
          clearcoatRoughness={0.08}
          transmission={cutaway ? 0 : 0.12}
          ior={1.5}
          thickness={0.4}
          attenuationColor="#f0e8d0"
          attenuationDistance={2}
          clippingPlanes={cutaway ? [clipPlane] : []}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Dentin layer — slightly smaller, warmer color */}
      <mesh position={[0, morphology.crownY, 0]} scale={[0.82, 0.86, 0.82]}>
        {morphology.crownGeo}
        <meshStandardMaterial
          color="#e6c98a"
          roughness={0.7}
          clippingPlanes={cutaway ? [clipPlane] : []}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Pulp chamber — small red core */}
      <mesh position={[0, morphology.crownY - 0.1, 0]}>
        <sphereGeometry args={[0.32, 24, 16]} />
        <meshStandardMaterial
          color="#cc4444"
          emissive="#990000"
          emissiveIntensity={0.25}
          roughness={0.6}
          clippingPlanes={cutaway ? [clipPlane] : []}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Root canal(s) — long thin red cylinder(s) extending into root */}
      {morphology.canals.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} rotation={c.rot || [0, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.04, morphology.rootLen, 12]} />
          <meshStandardMaterial
            color="#bb3333"
            emissive="#770000"
            emissiveIntensity={0.2}
            clippingPlanes={cutaway ? [clipPlane] : []}
          />
        </mesh>
      ))}

      {/* Root — cementum shell */}
      {morphology.roots.map((r, i) => (
        <mesh key={i} position={[r.x, r.y, r.z]}>
          <coneGeometry args={[r.topRadius, morphology.rootLen, 16, 1, false, 0, Math.PI * 2]} />
          <meshPhysicalMaterial
            color="#d4b890"
            roughness={0.85}
            metalness={0.02}
            clippingPlanes={cutaway ? [clipPlane] : []}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Lesion / restoration overlay placed at the right landmark */}
      {pathology?.kind && landmark && (
        <PathologyOverlay
          pathology={pathology}
          landmark={landmark}
          fdi={fdi}
          morphology={morphology}
        />
      )}
    </group>
  );
}

/* ──────────────────────────────────────────────────────────
   Pathology overlay — cavity / filling / crown / RCT etc. at
   the anatomically correct landmark for the chosen surfaces.
─────────────────────────────────────────────────────────── */
function PathologyOverlay({ pathology, landmark, fdi, morphology }) {
  const { kind, depth, classification, surfaces } = pathology;
  const groupRef = useRef();
  const pulseRef = useRef();

  useFrame(({ clock }) => {
    if (pulseRef.current && (kind === 'caries' && depth === 'pulp_exposure')) {
      pulseRef.current.material.opacity = 0.4 + Math.sin(clock.elapsedTime * 3) * 0.25;
    }
  });

  // Size + depth scaling
  const lesionDepth = {
    incipient: 0.05,
    enamel: 0.12,
    dentin: 0.28,
    deep_dentin: 0.45,
    pulp_exposure: 0.7,
  }[depth || 'enamel'];

  const lesionColor = {
    incipient: '#fef3c7',
    enamel: '#a87838',
    dentin: '#5a3318',
    deep_dentin: '#2a1208',
    pulp_exposure: '#000',
  }[depth || 'enamel'];

  // Crown decision: special-case all-ceramic for 36 & 37 even if dentist
  // generically picked a "crown" — and when they pick 'all_ceramic_crown'
  // we render the right material regardless of tooth.
  const isAllCeramic = kind === 'all_ceramic_crown' || ([36, 37].includes(fdi) && kind?.includes('crown'));

  // CROWNS — full coronal coverage cap that REPLACES the natural crown look
  if (kind === 'all_ceramic_crown' || kind === 'pfm_crown' || kind === 'metal_crown') {
    const isMetal = kind === 'metal_crown';
    const isPFM = kind === 'pfm_crown';
    return (
      <group position={[0, morphology.crownY, 0]} ref={groupRef}>
        <mesh scale={[1.05, 1.08, 1.05]}>
          {morphology.crownGeo}
          <meshPhysicalMaterial
            color={isMetal ? '#c0c8d0' : isPFM ? '#f0e8d8' : '#f8f0e0'}
            metalness={isMetal ? 0.85 : isPFM ? 0.15 : 0.0}
            roughness={isMetal ? 0.18 : isPFM ? 0.25 : 0.18}
            clearcoat={1}
            clearcoatRoughness={isMetal ? 0.05 : 0.1}
            reflectivity={isMetal ? 0.95 : 0.6}
            transmission={!isMetal && !isPFM ? 0.05 : 0}
            ior={1.5}
            thickness={0.3}
          />
        </mesh>
        {/* Margin line at the cervical area */}
        <mesh position={[0, -morphology.crownH * 0.45, 0]}>
          <torusGeometry args={[0.95, 0.03, 8, 32]} />
          <meshStandardMaterial color="#888" roughness={0.5} />
        </mesh>
        <Html position={[0, morphology.crownH * 0.6 + 0.4, 0]} center distanceFactor={5}>
          <div className="bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
            {isAllCeramic ? 'All-Ceramic Crown' : isPFM ? 'PFM Crown' : 'Metal Crown'}
          </div>
        </Html>
      </group>
    );
  }

  // EXTRACTION — render the empty socket + faded ghost
  if (kind === 'extraction') {
    return (
      <group position={[0, morphology.crownY, 0]}>
        <mesh>
          {morphology.crownGeo}
          <meshStandardMaterial color="#444" transparent opacity={0.15} />
        </mesh>
        <Html position={[0, morphology.crownH * 0.6 + 0.4, 0]} center distanceFactor={5}>
          <div className="bg-red-900/80 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
            Extracted
          </div>
        </Html>
      </group>
    );
  }

  // RCT — gutta-percha visible in the canals
  if (kind === 'rct') {
    return (
      <group>
        {morphology.canals.map((c, i) => (
          <mesh key={i} position={[c.x, c.y, c.z]} rotation={c.rot || [0, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.06, morphology.rootLen * 0.95, 12]} />
            <meshStandardMaterial color="#ff7733" emissive="#cc3300" emissiveIntensity={0.45} />
          </mesh>
        ))}
        <Html position={[1.4, 0, 0]} center distanceFactor={5}>
          <div className="bg-orange-900/80 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
            RCT — Gutta Percha
          </div>
        </Html>
      </group>
    );
  }

  // VENEER — thin shell on the buccal/labial surface
  if (kind === 'veneer') {
    const buccal = landmark.find((l) => l.surface === 'B') || { x: 0, y: morphology.crownY, z: 0.85 };
    return (
      <mesh position={[buccal.x * 1.05, morphology.crownY, buccal.z * 1.05]}>
        <boxGeometry args={[0.85, morphology.crownH * 0.85, 0.06]} />
        <meshPhysicalMaterial
          color="#fff8e8"
          metalness={0}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transmission={0.1}
          ior={1.5}
        />
      </mesh>
    );
  }

  // SEALANT — thin coat in the central groove
  if (kind === 'sealant') {
    return (
      <mesh position={[0, morphology.crownY + morphology.crownH * 0.45, 0]}>
        <boxGeometry args={[0.7, 0.05, 0.5]} />
        <meshPhysicalMaterial color="#cce8ff" transparent opacity={0.7} clearcoat={1} />
      </mesh>
    );
  }

  // FILLINGS / CARIES / INLAY — placed at every selected surface landmark
  return (
    <group ref={groupRef}>
      {landmark.map((l, i) => {
        const fillColor =
          kind === 'composite_filling' ? '#f5ecd0' :
          kind === 'amalgam' ? '#7a7a82' :
          kind === 'inlay' ? '#e8e0c8' :
          lesionColor; // caries

        const isCaries = kind === 'caries';
        const r = 0.18 + (lesionDepth || 0.1) * 0.5;

        return (
          <group key={i} position={[l.x, l.y, l.z]} rotation={l.rot || [0, 0, 0]}>
            {/* The actual lesion/restoration body — half-sphere into surface */}
            <mesh ref={i === 0 ? pulseRef : null}>
              <sphereGeometry args={[r, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial
                color={fillColor}
                roughness={isCaries ? 0.95 : 0.35}
                metalness={kind === 'amalgam' ? 0.6 : 0.05}
                clearcoat={!isCaries ? 0.5 : 0}
                transparent={isCaries && depth === 'pulp_exposure'}
                opacity={isCaries && depth === 'pulp_exposure' ? 0.8 : 1}
              />
            </mesh>
            {/* Pulp involvement — bright red core showing through */}
            {isCaries && depth === 'pulp_exposure' && (
              <mesh position={[0, -r * 0.5, 0]}>
                <sphereGeometry args={[r * 0.45, 16, 12]} />
                <meshStandardMaterial color="#ff2222" emissive="#cc0000" emissiveIntensity={0.6} />
              </mesh>
            )}
            {/* Surface label */}
            <Html position={[0, r + 0.15, 0]} center distanceFactor={4}>
              <div className="bg-black/80 text-amber-300 text-[8px] px-1 py-0.5 rounded whitespace-nowrap pointer-events-none border border-amber-500/30">
                {l.surface}
              </div>
            </Html>
          </group>
        );
      })}

      {/* Class label floating above */}
      <Html position={[0, morphology.crownH * 0.6 + 0.5, 0]} center distanceFactor={5}>
        <div className="bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
          Class {classification} {surfaces?.join('') || ''} · {kindLabel(kind)}
        </div>
      </Html>
    </group>
  );
}

/* ──────────────────────────────────────────────────────────
   Tooth morphology — tells us what shape, how many roots,
   and where the surface landmarks are.
─────────────────────────────────────────────────────────── */
function getToothMorphology(fdi) {
  const pos = fdi % 10;
  const isUpper = fdi < 30;
  const isMolar = pos >= 6;
  const isPremolar = pos >= 4 && pos < 6;
  const isCanine = pos === 3;

  // Crown geometry: molars are wider/blockier, anteriors are blade-like
  let crownGeo;
  let crownH = 1.6;
  let crownY = -0.4;
  let rootLen = 1.6;
  let roots = [];
  let canals = [];

  if (isMolar) {
    crownH = 1.4;
    crownGeo = (
      <boxGeometry args={[1.7, crownH, 1.5]} />
    );
    // Upper molar = 3 roots, lower molar = 2 roots
    if (isUpper) {
      roots = [
        { x: -0.5, y: -2.0, z: 0.4, topRadius: 0.35 },
        { x: 0.5, y: -2.0, z: 0.4, topRadius: 0.35 },
        { x: 0, y: -2.0, z: -0.5, topRadius: 0.35 },
      ];
      canals = [
        { x: -0.5, y: -2.0, z: 0.4 },
        { x: 0.5, y: -2.0, z: 0.4 },
        { x: 0, y: -2.0, z: -0.5 },
      ];
    } else {
      roots = [
        { x: -0.45, y: -2.0, z: 0, topRadius: 0.4 },
        { x: 0.45, y: -2.0, z: 0, topRadius: 0.4 },
      ];
      canals = [
        { x: -0.45, y: -2.0, z: 0 },
        { x: 0.45, y: -2.0, z: 0 },
      ];
    }
  } else if (isPremolar) {
    crownH = 1.5;
    crownGeo = <boxGeometry args={[1.2, crownH, 1.3]} />;
    roots = [{ x: 0, y: -2.0, z: 0, topRadius: 0.4 }];
    canals = [{ x: 0, y: -2.0, z: 0 }];
  } else if (isCanine) {
    crownH = 1.9;
    crownGeo = <boxGeometry args={[0.9, crownH, 1.1]} />;
    crownY = -0.2;
    rootLen = 2.2;
    roots = [{ x: 0, y: -2.2, z: 0, topRadius: 0.4 }];
    canals = [{ x: 0, y: -2.2, z: 0 }];
  } else {
    // incisor — flat blade
    crownH = 1.6;
    crownGeo = <boxGeometry args={[0.95, crownH, 0.55]} />;
    rootLen = 1.8;
    roots = [{ x: 0, y: -2.1, z: 0, topRadius: 0.35 }];
    canals = [{ x: 0, y: -2.1, z: 0 }];
  }

  return {
    fdi,
    isUpper,
    isMolar,
    isPremolar,
    isCanine,
    crownGeo,
    crownH,
    crownY,
    rootLen,
    roots,
    canals,
    // tooth half-extents used for landmark placement
    halfX: isMolar ? 0.85 : isPremolar ? 0.6 : isCanine ? 0.45 : 0.475,
    halfZ: isMolar ? 0.75 : isPremolar ? 0.65 : isCanine ? 0.55 : 0.275,
  };
}

/* ──────────────────────────────────────────────────────────
   Map dentist surface picks → 3D landmark positions on the
   morphology, oriented for that surface.
   M = mesial, O = occlusal, D = distal, B = buccal, L = lingual,
   I = incisal.

   Note: the FDI mesial/distal direction depends on the quadrant.
   For simplicity in this single-tooth viewer we always render
   M to the -X side and D to the +X side; B is +Z (toward viewer),
   L is -Z (away from viewer).
─────────────────────────────────────────────────────────── */
function surfacesToLandmark(surfaces, classification, m) {
  if (!surfaces || surfaces.length === 0) {
    // Default landmark if classification implies one and no surface picked yet
    if (classification === 'I')   return [{ surface: 'O', x: 0, y: m.crownY + m.crownH * 0.5, z: 0 }];
    if (classification === 'V')   return [{ surface: 'B', x: 0, y: m.crownY - m.crownH * 0.4, z: m.halfZ }];
    if (classification === 'VI')  return [{ surface: m.isMolar ? 'O' : 'I', x: 0, y: m.crownY + m.crownH * 0.5, z: 0 }];
    return [];
  }

  const out = [];
  for (const s of surfaces) {
    if (s === 'O') out.push({ surface: 'O', x: 0, y: m.crownY + m.crownH * 0.5, z: 0 });
    if (s === 'I') out.push({ surface: 'I', x: 0, y: m.crownY + m.crownH * 0.5, z: 0 });
    if (s === 'M') out.push({ surface: 'M', x: -m.halfX, y: m.crownY + m.crownH * 0.15, z: 0, rot: [0, 0, Math.PI / 2] });
    if (s === 'D') out.push({ surface: 'D', x:  m.halfX, y: m.crownY + m.crownH * 0.15, z: 0, rot: [0, 0, -Math.PI / 2] });
    if (s === 'B') {
      // Class V is at the cervical third, others mid-crown
      const yOff = classification === 'V' ? m.crownY - m.crownH * 0.35 : m.crownY + m.crownH * 0.1;
      out.push({ surface: 'B', x: 0, y: yOff, z: m.halfZ, rot: [Math.PI / 2, 0, 0] });
    }
    if (s === 'L') {
      const yOff = classification === 'V' ? m.crownY - m.crownH * 0.35 : m.crownY + m.crownH * 0.1;
      out.push({ surface: 'L', x: 0, y: yOff, z: -m.halfZ, rot: [-Math.PI / 2, 0, 0] });
    }
  }
  return out;
}

/* ── Helpers ─────────────────────────────────────────────── */
function kindLabel(k) {
  return ({
    caries: 'Caries',
    composite_filling: 'Composite',
    amalgam: 'Amalgam',
    inlay: 'Inlay',
    sealant: 'Sealant',
    veneer: 'Veneer',
    all_ceramic_crown: 'All-Ceramic Crown',
    pfm_crown: 'PFM Crown',
    metal_crown: 'Metal Crown',
    rct: 'RCT',
    extraction: 'Extraction',
  })[k] || k;
}

function pathologyHumanLabel(p, fdi) {
  const surf = (p.surfaces || []).join('') || (p.classification === 'I' ? 'O' : '');
  const cls = p.classification ? `Class ${p.classification}${surf ? ' ' + surf : ''}` : '';
  return `#${fdi} · ${cls} · ${kindLabel(p.kind)}`;
}
