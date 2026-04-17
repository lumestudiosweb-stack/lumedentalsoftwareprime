import { useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { toothName } from './ToothPicker';

/**
 * ToothAnatomyPanel — side panel with a 3D cross-section of the picked
 * tooth. When pathology is set the camera automatically faces the
 * affected surface and the clipping plane is rotated so the cavity
 * is exposed in cross-section rather than hidden.
 */
export default function ToothAnatomyPanel({ fdi, pathology, onClose }) {
  if (!fdi) return null;

  const morphology = useMemo(() => getToothMorphology(fdi), [fdi]);
  const primarySurface = pathology?.surfaces?.[0] || null;

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
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xs px-2">✕</button>
        )}
      </div>

      {/* 3D Viewer — taller so cross-section is clearly visible */}
      <div className="h-80 bg-gradient-to-b from-[#0a0a14] to-[#000]">
        <Canvas
          camera={{ position: [-2, 3, 8], fov: 38 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, localClippingEnabled: true }}
          onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[4, 7, 6]} intensity={1.5} />
          <directionalLight position={[-5, 4, -4]} intensity={0.6} color="#aaccff" />
          <pointLight position={[-4, 2, 4]} intensity={0.55} color="#ffeedd" />
          <spotLight position={[0, 9, 8]} intensity={0.8} angle={0.45} penumbra={0.5} />
          <Suspense fallback={null}>
            <CameraController primarySurface={primarySurface} pathologyKind={pathology?.kind} />
            <ToothScene morphology={morphology} pathology={pathology} fdi={fdi} />
            <Environment preset="studio" environmentIntensity={0.5} />
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

      {/* Legend */}
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
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Diagnosis / Plan</div>
            <div className="text-xs text-white font-medium">{pathologyHumanLabel(pathology, fdi)}</div>
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
   Auto-orient the camera toward the affected surface
   so the cavity is immediately visible without orbiting.
─────────────────────────────────────────────────────────── */
function CameraController({ primarySurface, pathologyKind }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!pathologyKind) return;
    // Move to a vantage point that faces the surface with the lesion
    const positions = {
      M: [-7, 3.5, 5],   // mesial — slightly above-front-left
      D: [7, 3.5, 5],    // distal
      O: [0, 10, 3],     // occlusal — from above
      I: [0, 10, 3],     // incisal — from above
      B: [0, 2, 9],      // buccal — straight front
      L: [0, 2, -9],     // lingual — from behind
    };
    const pos = positions[primarySurface] || [-3, 4, 7];
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(0, -0.3, 0);
  }, [primarySurface, pathologyKind, camera]);

  return null;
}

/* ──────────────────────────────────────────────────────────
   3D scene
─────────────────────────────────────────────────────────── */
function ToothScene({ morphology, pathology, fdi }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (!pathology?.kind) {
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.05;
    }
  });

  const cutaway = !!pathology?.kind && pathology.kind !== 'sealant';

  return (
    <group ref={groupRef}>
      {/* Alveolar bone */}
      <mesh position={[0, -2.4, 0]}>
        <cylinderGeometry args={[1.3, 1.4, 1.6, 32]} />
        <meshStandardMaterial color="#e8d8b8" roughness={0.95} />
      </mesh>
      {/* Gingiva */}
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[1.15, 1.25, 0.7, 32]} />
        <meshPhysicalMaterial color="#cc6677" roughness={0.7} clearcoat={0.3} clearcoatRoughness={0.5} />
      </mesh>
      {/* PDL */}
      <mesh position={[0, -2.0, 0]}>
        <cylinderGeometry args={[1.02, 1.08, 1.3, 32]} />
        <meshStandardMaterial color="#a0a098" roughness={0.9} transparent opacity={0.85} />
      </mesh>
      <ToothAnatomy morphology={morphology} cutaway={cutaway} pathology={pathology} fdi={fdi} />
      <Html position={[0, 2.6, 0]} center distanceFactor={6}>
        <div className="bg-black/70 text-white text-[10px] px-2 py-0.5 rounded border border-white/10 pointer-events-none">
          #{fdi}
        </div>
      </Html>
    </group>
  );
}

/* ──────────────────────────────────────────────────────────
   Layered tooth anatomy with SMART clipping plane.

   The clip direction is chosen based on the primary surface so the
   cavity is always in the EXPOSED half, not the hidden half.

   THREE.Plane(normal, constant) clips fragments where
     dot(normal, point) + constant > 0

   Surface → clip logic:
     M  — clip x > 0  (show mesial / x < 0 side)
     D  — clip x < 0  (show distal / x > 0 side)
     B  — clip z < 0  (show buccal / z > 0 side)
     L  — clip z > 0  (show lingual / z < 0 side)
     O/I — clip x < 0 (show right half for occlusal/incisal)
─────────────────────────────────────────────────────────── */
function ToothAnatomy({ morphology, cutaway, pathology, fdi }) {
  const landmark = useMemo(
    () => surfacesToLandmark(pathology?.surfaces || [], pathology?.classification, morphology),
    [pathology?.surfaces, pathology?.classification, morphology]
  );

  const clipPlane = useMemo(() => {
    if (!cutaway) return null;
    const s = pathology?.surfaces?.[0];
    if (s === 'M') return new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);   // hide +X → expose mesial
    if (s === 'D') return new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);  // hide -X → expose distal
    if (s === 'B') return new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);  // hide -Z → expose buccal
    if (s === 'L') return new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);   // hide +Z → expose lingual
    return new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);                 // default: show +X half
  }, [cutaway, pathology?.surfaces]);

  const clipPlanes = cutaway && clipPlane ? [clipPlane] : [];

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
          clippingPlanes={clipPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Dentin layer */}
      <mesh position={[0, morphology.crownY, 0]} scale={[0.82, 0.86, 0.82]}>
        {morphology.crownGeo}
        <meshStandardMaterial
          color="#e6c98a"
          roughness={0.7}
          clippingPlanes={clipPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Pulp chamber */}
      <mesh position={[0, morphology.crownY - 0.1, 0]}>
        <sphereGeometry args={[0.32, 24, 16]} />
        <meshStandardMaterial
          color="#cc4444"
          emissive="#990000"
          emissiveIntensity={0.3}
          roughness={0.6}
          clippingPlanes={clipPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Root canals */}
      {morphology.canals.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} rotation={c.rot || [0, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.04, morphology.rootLen, 12]} />
          <meshStandardMaterial
            color="#bb3333"
            emissive="#770000"
            emissiveIntensity={0.2}
            clippingPlanes={clipPlanes}
          />
        </mesh>
      ))}

      {/* Roots */}
      {morphology.roots.map((r, i) => (
        <mesh key={i} position={[r.x, r.y, r.z]}>
          <coneGeometry args={[r.topRadius, morphology.rootLen, 16, 1, false, 0, Math.PI * 2]} />
          <meshPhysicalMaterial
            color="#d4b890"
            roughness={0.85}
            metalness={0.02}
            clippingPlanes={clipPlanes}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Pathology overlay — rendered WITHOUT clipping so it shows on both halves */}
      {pathology?.kind && landmark && landmark.length > 0 && (
        <PathologyOverlay pathology={pathology} landmark={landmark} fdi={fdi} morphology={morphology} />
      )}
    </group>
  );
}

/* ──────────────────────────────────────────────────────────
   Realistic pathology overlay

   Group local axes (after rot is applied):
     +Y  = outward from tooth surface  (above surface, visible from outside)
     −Y  = inward into tooth           (below surface, visible in cross-section)
     XZ  = parallel to tooth surface   (for flat discs/rings)

   Cavity rendering layers:
     1. Stain ring  (Y ≈ +0.03) — brown discoloration halo, visible from outside
     2. Dark disc   (Y ≈ +0.02) — cavity opening on the surface
     3. Cavity body (Y ≈ −0.5r) — sphere going INTO tooth (cross-section view)
     4. Deep layer  (Y ≈ −1.1r) — darker core
     5. Pulp (opt.) (Y ≈ −1.6r) — red pulp for pulp_exposure

   The tooth mesh is clipped so the cavity side is exposed, making
   layers 3–5 clearly visible without any transparency tricks.
─────────────────────────────────────────────────────────── */
function PathologyOverlay({ pathology, landmark, fdi, morphology }) {
  const { kind, depth, classification, surfaces } = pathology;
  const pulseRef = useRef();
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (pulseRef.current && kind === 'caries' && depth === 'pulp_exposure') {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.18;
      pulseRef.current.scale.set(s, s, s);
    }
  });

  // Radius scales with lesion depth
  const r = {
    incipient: 0.09,
    enamel: 0.17,
    dentin: 0.31,
    deep_dentin: 0.47,
    pulp_exposure: 0.66,
  }[depth || 'enamel'];

  // Color palette per depth — outermost stain → cavity surface → deep → inner
  const col = {
    incipient:     { stain: '#c4a060', opening: '#a87838', body: '#8B5E20', deep: '#5a3810' },
    enamel:        { stain: '#9B6020', opening: '#7B4010', body: '#5a2808', deep: '#3a1805' },
    dentin:        { stain: '#8B4513', opening: '#5a2808', body: '#3a1205', deep: '#100400' },
    deep_dentin:   { stain: '#6a3010', opening: '#3a1205', body: '#1a0602', deep: '#050000' },
    pulp_exposure: { stain: '#5a2010', opening: '#2a0802', body: '#050000', deep: '#cc0000' },
  }[depth || 'enamel'];

  // ── CROWNS ────────────────────────────────────────────────────
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
        <mesh position={[0, -morphology.crownH * 0.45, 0]}>
          <torusGeometry args={[0.95, 0.03, 8, 32]} />
          <meshStandardMaterial color="#888" roughness={0.5} />
        </mesh>
        <Html position={[0, morphology.crownH * 0.6 + 0.4, 0]} center distanceFactor={5}>
          <div className="bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
            {kind === 'all_ceramic_crown' ? 'All-Ceramic Crown' : kind === 'pfm_crown' ? 'PFM Crown' : 'Metal Crown'}
          </div>
        </Html>
      </group>
    );
  }

  // ── EXTRACTION ──────────────────────────────────────────────
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

  // ── RCT ────────────────────────────────────────────────────
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

  // ── VENEER ──────────────────────────────────────────────────
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

  // ── SEALANT ─────────────────────────────────────────────────
  if (kind === 'sealant') {
    return (
      <mesh position={[0, morphology.crownY + morphology.crownH * 0.45, 0]}>
        <boxGeometry args={[0.7, 0.05, 0.5]} />
        <meshPhysicalMaterial color="#cce8ff" transparent opacity={0.7} clearcoat={1} />
      </mesh>
    );
  }

  // ── CARIES / FILLINGS / INLAY ────────────────────────────────
  return (
    <group ref={groupRef}>
      {landmark.map((l, idx) => {
        const isCaries = kind === 'caries';

        if (isCaries) {
          return (
            <group key={idx} position={[l.x, l.y, l.z]} rotation={l.rot || [0, 0, 0]}>
              {/*
                Layer 1 — stain halo
                CircleGeometry and RingGeometry are flat in the XZ plane
                facing +Y. In local space +Y = outward from surface, so
                they lie flat against the tooth exterior and face the
                camera when looking at the affected surface.
              */}
              <mesh position={[0, 0.04, 0]}>
                <ringGeometry args={[r * 0.92, r * 2.3, 26]} />
                <meshStandardMaterial
                  color={col.stain}
                  roughness={0.95}
                  transparent
                  opacity={0.72}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>

              {/* Layer 2 — cavity opening: dark filled disc on the surface */}
              <mesh position={[0, 0.025, 0]}>
                <circleGeometry args={[r * 0.9, 24]} />
                <meshStandardMaterial
                  color={col.opening}
                  roughness={1.0}
                  side={THREE.DoubleSide}
                />
              </mesh>

              {/*
                Layer 3 — cavity body: sphere going INTO tooth (−Y in local
                space = inward). Exposed by the cross-section clipping plane.
              */}
              <mesh position={[0, -r * 0.48, 0]}>
                <sphereGeometry args={[r * 0.88, 20, 16]} />
                <meshStandardMaterial color={col.body} roughness={1.0} />
              </mesh>

              {/* Layer 4 — deep cavity: darker, smaller sphere further inside */}
              <mesh position={[0, -r * 1.1, 0]}>
                <sphereGeometry args={[r * 0.58, 16, 12]} />
                <meshStandardMaterial
                  color={col.deep}
                  roughness={1.0}
                  emissive={depth === 'pulp_exposure' ? '#880000' : '#000000'}
                  emissiveIntensity={depth === 'pulp_exposure' ? 0.7 : 0}
                />
              </mesh>

              {/* Dentin exposure ring — tan rim visible where enamel is breached */}
              {(depth === 'dentin' || depth === 'deep_dentin' || depth === 'pulp_exposure') && (
                <mesh position={[0, -r * 0.05, 0]}>
                  <ringGeometry args={[r * 0.72, r * 0.95, 22]} />
                  <meshStandardMaterial
                    color="#c8a060"
                    roughness={0.85}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              )}

              {/* Layer 5 — pulp: pulsing red sphere at the very bottom */}
              {depth === 'pulp_exposure' && (
                <mesh ref={idx === 0 ? pulseRef : null} position={[0, -r * 1.62, 0]}>
                  <sphereGeometry args={[r * 0.38, 14, 12]} />
                  <meshStandardMaterial
                    color="#ff2222"
                    emissive="#cc0000"
                    emissiveIntensity={0.9}
                  />
                </mesh>
              )}

              {/* Surface label */}
              <Html position={[0, r * 1.6 + 0.25, 0]} center distanceFactor={4}>
                <div className="bg-black/85 text-amber-300 text-[8px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none border border-amber-500/40">
                  {l.surface} — Caries · {(depth || '').replace('_', ' ')}
                </div>
              </Html>
            </group>
          );
        }

        // ── Fillings (composite / amalgam / inlay) ──────────────
        const fillColor =
          kind === 'composite_filling' ? '#f0ead8' :
          kind === 'amalgam'           ? '#848490' :
                                         '#e2d9c0'; // inlay
        return (
          <group key={idx} position={[l.x, l.y, l.z]} rotation={l.rot || [0, 0, 0]}>
            {/* Filling dome — half-sphere protruding from surface */}
            <mesh position={[0, r * 0.12, 0]}>
              <sphereGeometry args={[r * 0.95, 22, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial
                color={fillColor}
                roughness={kind === 'amalgam' ? 0.22 : 0.28}
                metalness={kind === 'amalgam' ? 0.65 : 0.04}
                clearcoat={kind !== 'amalgam' ? 0.85 : 0.2}
                clearcoatRoughness={0.14}
              />
            </mesh>
            {/* Margin ring */}
            <mesh position={[0, 0.02, 0]}>
              <ringGeometry args={[r * 0.88, r * 1.06, 26]} />
              <meshStandardMaterial
                color={kind === 'amalgam' ? '#555' : '#c8b890'}
                roughness={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Html position={[0, r + 0.3, 0]} center distanceFactor={4}>
              <div className="bg-black/80 text-blue-200 text-[8px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none border border-blue-500/30">
                {l.surface} — {kindLabel(kind)}
              </div>
            </Html>
          </group>
        );
      })}

      {/* Class label */}
      <Html position={[0, morphology.crownH * 0.6 + 0.55, 0]} center distanceFactor={5}>
        <div className="bg-black/80 text-white text-[9px] px-2 py-0.5 rounded whitespace-nowrap pointer-events-none border border-white/10">
          Class {classification} {surfaces?.join('') || ''} · {kindLabel(kind)}
        </div>
      </Html>
    </group>
  );
}

/* ──────────────────────────────────────────────────────────
   Tooth morphology
─────────────────────────────────────────────────────────── */
/* Build a real molar crown — domed top with 4 cusps and a central fossa */
function buildMolarCrownGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d, 16, 8, 16);
  const pos = geo.attributes.position;
  const halfH = h / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Round corners (barrel-shape the box)
    const r = Math.sqrt((x / (w / 2)) ** 2 + (z / (d / 2)) ** 2);
    if (r > 0.001) {
      const heightFactor = 1 - Math.pow(Math.abs(y) / halfH, 2) * 0.15;
      pos.setX(i, x * heightFactor);
      pos.setZ(i, z * heightFactor);
    }
    // Top of crown — sculpt 4 cusps + central fossa
    if (y > halfH * 0.55) {
      const localT = (y - halfH * 0.55) / (halfH * 0.45);
      // Cusp pattern: four bumps at ±x/2, ±z/2
      const cuspX = Math.cos((x / (w / 2)) * Math.PI);
      const cuspZ = Math.cos((z / (d / 2)) * Math.PI);
      const cuspBump = (cuspX + cuspZ) * 0.18;
      // Central fossa — depression in the middle
      const distFromCenter = Math.sqrt((x / (w / 2)) ** 2 + (z / (d / 2)) ** 2);
      const fossa = Math.max(0, 1 - distFromCenter * 2.2) * -0.22;
      // Mesial-distal groove
      const groove = Math.exp(-Math.pow(z / (d * 0.06), 2)) * -0.08;
      pos.setY(i, y + (cuspBump + fossa + groove) * h * localT);
    }
    // Bottom — taper toward cervical line
    if (y < -halfH * 0.6) {
      const taper = 0.92;
      pos.setX(i, pos.getX(i) * taper);
      pos.setZ(i, pos.getZ(i) * taper);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/* Build an anterior incisor crown — flat blade with mamelons + incisal edge */
function buildIncisorCrownGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d, 12, 10, 8);
  const pos = geo.attributes.position;
  const halfH = h / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Curved labial face (front) and lingual concavity (back)
    const yT = (y + halfH) / h; // 0 bottom → 1 top
    if (z > 0) {
      // Labial — gently convex outward
      pos.setZ(i, z + Math.sin(yT * Math.PI) * 0.06);
    } else {
      // Lingual — concave (cingulum at cervical)
      const cingulum = yT < 0.3 ? (0.3 - yT) * 0.35 : 0;
      pos.setZ(i, z + Math.sin(yT * Math.PI) * 0.04 + cingulum);
    }
    // Incisal edge — slightly thinned with subtle mamelons
    if (y > halfH * 0.7) {
      const mamelon = Math.cos(x / (w / 2) * Math.PI * 1.5) * 0.04;
      pos.setY(i, y + mamelon);
      // Thin the incisal edge
      const t = (y - halfH * 0.7) / (halfH * 0.3);
      pos.setZ(i, pos.getZ(i) * (1 - t * 0.25));
    }
    // Cervical taper
    if (y < -halfH * 0.5) {
      pos.setX(i, x * 0.88);
      pos.setZ(i, pos.getZ(i) * 0.92);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/* Build a premolar crown — two cusps (buccal larger) */
function buildPremolarCrownGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d, 12, 8, 12);
  const pos = geo.attributes.position;
  const halfH = h / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Round the box
    const r = Math.sqrt((x / (w / 2)) ** 2 + (z / (d / 2)) ** 2);
    if (r > 0.001 && Math.abs(y) < halfH * 0.7) {
      pos.setX(i, x * (1 - r * 0.05));
      pos.setZ(i, z * (1 - r * 0.05));
    }
    if (y > halfH * 0.5) {
      // Two cusps: buccal (+z) larger, lingual (-z) smaller
      const localT = (y - halfH * 0.5) / (halfH * 0.5);
      const buccalCusp = Math.exp(-Math.pow((z - d * 0.25) / (d * 0.25), 2)) * 0.28;
      const lingualCusp = Math.exp(-Math.pow((z + d * 0.25) / (d * 0.25), 2)) * 0.20;
      const groove = Math.exp(-Math.pow(z / (d * 0.07), 2)) * -0.15;
      pos.setY(i, y + (buccalCusp + lingualCusp + groove) * h * localT);
    }
    if (y < -halfH * 0.6) {
      pos.setX(i, pos.getX(i) * 0.9);
      pos.setZ(i, pos.getZ(i) * 0.9);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/* Build a canine crown — single pointed cusp tip */
function buildCanineCrownGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d, 10, 12, 10);
  const pos = geo.attributes.position;
  const halfH = h / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Round + taper toward a point at top
    const yT = (y + halfH) / h;
    if (y > 0) {
      const taper = 1 - Math.pow(yT - 0.5, 2) * 1.4;
      pos.setX(i, x * Math.max(0.2, taper));
      pos.setZ(i, z * Math.max(0.2, taper));
    }
    // Cusp tip — sharp peak
    if (y > halfH * 0.7) {
      const localT = (y - halfH * 0.7) / (halfH * 0.3);
      const distFromCenter = Math.sqrt(x * x + z * z) / (w / 2);
      const tipBoost = Math.max(0, 1 - distFromCenter * 1.5) * 0.3;
      pos.setY(i, y + tipBoost * localT);
    }
    if (y < -halfH * 0.6) {
      pos.setX(i, pos.getX(i) * 0.9);
      pos.setZ(i, pos.getZ(i) * 0.9);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function getToothMorphology(fdi) {
  const pos = fdi % 10;
  const isUpper = fdi < 30;
  const isMolar = pos >= 6;
  const isPremolar = pos >= 4 && pos < 6;
  const isCanine = pos === 3;

  let crownGeo;
  let crownH = 1.6;
  let crownY = -0.4;
  let rootLen = 1.6;
  let roots = [];
  let canals = [];
  let crownBufferGeo;

  if (isMolar) {
    crownH = 1.5;
    crownBufferGeo = buildMolarCrownGeometry(1.8, crownH, 1.6);
    crownGeo = <primitive object={crownBufferGeo} attach="geometry" />;
    if (isUpper) {
      roots  = [{ x: -0.55, y: -2.0, z:  0.45, topRadius: 0.32 }, { x: 0.55, y: -2.0, z: 0.45, topRadius: 0.32 }, { x: 0, y: -2.0, z: -0.55, topRadius: 0.32 }];
      canals = [{ x: -0.55, y: -2.0, z:  0.45 }, { x: 0.55, y: -2.0, z: 0.45 }, { x: 0, y: -2.0, z: -0.55 }];
    } else {
      roots  = [{ x: -0.5, y: -2.0, z: 0, topRadius: 0.38 }, { x: 0.5, y: -2.0, z: 0, topRadius: 0.38 }];
      canals = [{ x: -0.5, y: -2.0, z: 0 }, { x: 0.5, y: -2.0, z: 0 }];
    }
  } else if (isPremolar) {
    crownH = 1.5;
    crownBufferGeo = buildPremolarCrownGeometry(1.25, crownH, 1.35);
    crownGeo = <primitive object={crownBufferGeo} attach="geometry" />;
    roots  = [{ x: 0, y: -2.0, z: 0, topRadius: 0.4 }];
    canals = [{ x: 0, y: -2.0, z: 0 }];
  } else if (isCanine) {
    crownH = 1.95;
    crownBufferGeo = buildCanineCrownGeometry(0.95, crownH, 1.15);
    crownGeo = <primitive object={crownBufferGeo} attach="geometry" />;
    crownY = -0.2;
    rootLen = 2.3;
    roots  = [{ x: 0, y: -2.3, z: 0, topRadius: 0.42 }];
    canals = [{ x: 0, y: -2.3, z: 0 }];
  } else {
    crownH = 1.7;
    crownBufferGeo = buildIncisorCrownGeometry(0.95, crownH, 0.6);
    crownGeo = <primitive object={crownBufferGeo} attach="geometry" />;
    rootLen = 1.9;
    roots  = [{ x: 0, y: -2.1, z: 0, topRadius: 0.35 }];
    canals = [{ x: 0, y: -2.1, z: 0 }];
  }

  return {
    fdi, isUpper, isMolar, isPremolar, isCanine,
    crownGeo, crownH, crownY, rootLen, roots, canals,
    halfX: isMolar ? 0.9 : isPremolar ? 0.62 : isCanine ? 0.47 : 0.48,
    halfZ: isMolar ? 0.8  : isPremolar ? 0.67 : isCanine ? 0.57 : 0.30,
  };
}

/* ──────────────────────────────────────────────────────────
   Surface → 3D landmark

   Rotation convention: after applying l.rot, local +Y = outward
   from the tooth surface at that landmark.

     M (mesial)  x = −halfX  rot = [0, 0, +PI/2]  → +Y = global −X (outward)
     D (distal)  x = +halfX  rot = [0, 0, −PI/2]  → +Y = global +X (outward)
     B (buccal)  z = +halfZ  rot = [−PI/2, 0, 0]  → +Y = global +Z (outward)
     L (lingual) z = −halfZ  rot = [+PI/2, 0, 0]  → +Y = global −Z (outward)
     O / I       (no rot)    → +Y = global +Y (upward = outward for crown top)
─────────────────────────────────────────────────────────── */
function surfacesToLandmark(surfaces, classification, m) {
  if (!surfaces || surfaces.length === 0) {
    if (classification === 'I')  return [{ surface: 'O', x: 0, y: m.crownY + m.crownH * 0.5, z: 0 }];
    if (classification === 'V')  return [{ surface: 'B', x: 0, y: m.crownY - m.crownH * 0.4, z: m.halfZ, rot: [-Math.PI / 2, 0, 0] }];
    if (classification === 'VI') return [{ surface: m.isMolar ? 'O' : 'I', x: 0, y: m.crownY + m.crownH * 0.5, z: 0 }];
    return [];
  }

  const out = [];
  for (const s of surfaces) {
    if (s === 'O') out.push({ surface: 'O', x: 0,        y: m.crownY + m.crownH * 0.5,                                  z: 0 });
    if (s === 'I') out.push({ surface: 'I', x: 0,        y: m.crownY + m.crownH * 0.5,                                  z: 0 });
    if (s === 'M') out.push({ surface: 'M', x: -m.halfX, y: m.crownY + m.crownH * 0.15,                                 z: 0, rot: [0, 0,  Math.PI / 2] });
    if (s === 'D') out.push({ surface: 'D', x:  m.halfX, y: m.crownY + m.crownH * 0.15,                                 z: 0, rot: [0, 0, -Math.PI / 2] });
    if (s === 'B') {
      const yOff = classification === 'V' ? m.crownY - m.crownH * 0.35 : m.crownY + m.crownH * 0.1;
      out.push({ surface: 'B', x: 0, y: yOff, z:  m.halfZ, rot: [-Math.PI / 2, 0, 0] });
    }
    if (s === 'L') {
      const yOff = classification === 'V' ? m.crownY - m.crownH * 0.35 : m.crownY + m.crownH * 0.1;
      out.push({ surface: 'L', x: 0, y: yOff, z: -m.halfZ, rot: [ Math.PI / 2, 0, 0] });
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
