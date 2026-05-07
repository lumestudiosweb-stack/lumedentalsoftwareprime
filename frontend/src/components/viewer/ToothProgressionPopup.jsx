import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

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

/* ──────────────────────────────────────────────────────────────────────
   FDI → real OBJ tooth model mapping (anatomical library in public/teeth)
   The library has 1 model per tooth TYPE; we mirror via scale.x = -1
   for the right side of each arch.
─────────────────────────────────────────────────────────────────────── */
const TOOTH_FILES = {
  upper: {
    1: { folder: 'maxillary left central incisor',                obj: 'UL1sketch1_1.OBJ' },
    2: { folder: 'maxillary lateral incisor',                      obj: 'UL2sketch_1.OBJ'  },
    3: { folder: 'maxillary canine',                               obj: 'UL3sketch1_1.OBJ' },
    4: { folder: 'maxillary first premolar',                       obj: 'UL4sketch_1.OBJ'  },
    5: { folder: 'Maxillary Second Premolar',                      obj: 'UL5sketch_1.OBJ'  },
    6: { folder: 'Maxillary First Molar with Cusp of Carabelli',   obj: 'UL4sketch_1.OBJ'  },
    7: { folder: 'maxillary second molar',                         obj: 'UL7sketch_1.OBJ'  },
    8: { folder: 'maxillary third molar',                          obj: 'UL8sketch_1.OBJ'  },
  },
  lower: {
    1: { folder: 'mandibular left central incisor',  obj: 'LL1sketch_1.OBJ'  },
    2: { folder: 'mandibular left lateral incisor',  obj: 'LL1sketch_1.OBJ'  },
    3: { folder: 'mandibular left canine',           obj: 'LL3sketch_1.OBJ'  },
    4: { folder: 'mandibular first premolar',        obj: 'UL4sketch_1.OBJ'  },
    5: { folder: 'mandibular left second premolar',  obj: 'LL5sketch1_1.OBJ' },
    6: { folder: 'mandibular first molar',           obj: 'LL6sketch_1.OBJ'  },
    7: { folder: 'mandibular second molar',          obj: 'LL7sketch_1.OBJ'  },
    8: { folder: 'mandibular third molar',           obj: 'LL8sketc_1.OBJ'   },
  },
};

// Texture extension per folder (from extract_tooth_textures.sh output).
// Most folders end up with .png; the Carabelli zip ships .jpeg.
const TEXTURE_EXT = {
  'Maxillary First Molar with Cusp of Carabelli': { diffuse: 'jpeg', ao: 'jpeg' },
};

function getToothFileInfo(fdi) {
  if (!fdi) return null;
  const fdiStr = String(fdi);
  const archDigit = fdiStr[0];
  const pos = parseInt(fdiStr[1], 10);
  if (!pos || pos < 1 || pos > 8) return null;
  const arch = (archDigit === '1' || archDigit === '2') ? 'upper' : 'lower';
  const isRight = (archDigit === '1' || archDigit === '4');
  const entry = TOOTH_FILES[arch]?.[pos];
  if (!entry) return null;
  const folderEnc = encodeURIComponent(entry.folder);
  const exts = TEXTURE_EXT[entry.folder] || { diffuse: 'png', normal: 'png', ao: 'png' };
  return {
    url: `/teeth/${folderEnc}/${entry.obj}`,
    diffuseUrl: `/teeth/${folderEnc}/diffuse.${exts.diffuse || 'png'}`,
    normalUrl: `/teeth/${folderEnc}/normal.${exts.normal || 'png'}`,
    aoUrl: exts.ao ? `/teeth/${folderEnc}/ao.${exts.ao}` : null,
    mirror: isRight,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   RealToothModel — loads the actual OBJ tooth scan, normalizes its
   bounding box to a known size, and overlays the disease/treatment
   internal anatomy (canals, pulp, lesions, gutta, files) inside it.
─────────────────────────────────────────────────────────────────────── */
function RealToothModel({ fileInfo, anatomy, phaseData, onReady }) {
  const obj = useLoader(OBJLoader, fileInfo.url);

  // Clone the OBJ tree (deep) and bake centering + scaling directly into
  // the clone's transform. Doing it on the OBJECT instead of via parent
  // <group> wrappers eliminates any chance of transform-order issues and
  // keeps Box3 math consistent with what's actually rendered.
  const { clone, decalTargetMesh, bbSize, bbTopY } = useMemo(() => {
    const c = obj.clone(true);

    const box = new THREE.Box3().setFromObject(c);
    if (box.isEmpty()) {
      return { clone: c, decalTargetMesh: null, bbSize: null, bbTopY: 0 };
    }

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxRoot = Math.max(...anatomy.roots.map((r) => r.length));
    const targetHeight = anatomy.crownH + maxRoot;
    const s = targetHeight / Math.max(size.y, 0.001);

    // Mirror right-side teeth, scale to target height, then translate so
    // the bbox center sits exactly at world origin.
    c.scale.set(fileInfo.mirror ? -s : s, s, s);
    c.position.set(-center.x * s * (fileInfo.mirror ? -1 : 1), -center.y * s, -center.z * s);
    c.updateMatrixWorld(true);

    // Find the first mesh inside the cloned tree — DecalGeometry needs a
    // single Mesh to project onto. Most Sketchfab teeth ship one mesh; if
    // there are multiple, the first one (usually the crown) is what the
    // user sees on the occlusal surface so it's the right target.
    let target = null;
    c.traverse((child) => {
      if (!target && child.isMesh) target = child;
    });

    return {
      clone: c,
      decalTargetMesh: target,
      bbSize: [size.x * s, size.y * s, size.z * s],
      bbTopY: (box.max.y - center.y) * s,
    };
  }, [obj, anatomy, fileInfo.mirror]);

  // Tell the popup the OBJ is ready — autoplay should only start once the
  // tooth is actually visible.
  useEffect(() => {
    if (obj && onReady) onReady();
  }, [obj, onReady]);

  // Diffuse map — loaded NON-BLOCKING via useState + TextureLoader.load()
  // (NOT useLoader, which would suspend the whole component if the texture
  // is slow/missing and leave the canvas blank). The OBJ renders the moment
  // it's ready; the texture is applied as soon as it arrives.
  const [diffuseMap, setDiffuseMap] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!fileInfo?.diffuseUrl) return undefined;
    const loader = new THREE.TextureLoader();
    loader.load(
      fileInfo.diffuseUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        setDiffuseMap(tex);
      },
      undefined,
      () => { /* swallow texture load errors — OBJ is still drawn */ }
    );
    return () => {
      cancelled = true;
    };
  }, [fileInfo?.diffuseUrl]);

  // Phase-based crown tinting — multiplied against the texture map. With an
  // opaque material this reads as "stained tooth" without weird overlay geometry.
  // Healthy = white (#fff = no tint, full texture color); disease shifts toward
  // tan/brown but stays bright enough to read against the dark popup background.
  let surfaceColor;
  if (phaseData.crownCap) surfaceColor = '#f5ecd8';                // ceramic crown
  else if (phaseData.caries > 0.85) surfaceColor = '#b08858';      // pulp/abscess — brown but visible
  else if (phaseData.caries > 0.6)  surfaceColor = '#d4a878';      // deep dentin — medium brown
  else if (phaseData.caries > 0.3)  surfaceColor = '#e8d0a0';      // dentin — tan
  else if (phaseData.caries > 0.05) surfaceColor = '#f5e8c8';      // enamel — slight cream
  else                              surfaceColor = '#ffffff';      // healthy — full texture

  // Pulp inflammation glows softly through the tooth
  const pulpEmissive = phaseData.pulpEmissive || 0;
  const emissiveColor = phaseData.caries > 0.7 ? '#3a0a02'
                       : pulpEmissive > 0      ? '#5a1a08'
                       : '#000';
  const emissiveIntensity = phaseData.caries > 0.7 ? 0.35 : pulpEmissive * 0.4;

  // Cavity surface stain — sits ON the OBJ's actual top vertex, NOT on
  // procedural anatomy. Tiny, occlusal-only, no protruding cone.
  const stainRadius = bbSize ? Math.min(bbSize[0], bbSize[2]) * 0.42 * phaseData.caries : 0;

  // Severity bucket for the canvas-textured cavity stain. Re-bake the
  // texture only when the bucket changes (avoids hammering the canvas API
  // every frame as caries level animates).
  const sevBucket = Math.round(phaseData.caries * 4);
  const cariesTexture = useMemo(
    () => (sevBucket > 0 ? makeCariesTexture(sevBucket / 4) : null),
    [sevBucket]
  );
  useEffect(() => () => { cariesTexture && cariesTexture.dispose(); }, [cariesTexture]);

  // (Decal-based approach was unreliable across different OBJ topologies —
  // some teeth ship the crown as a sub-mesh whose matrixWorld didn't pick
  // up the clone's scale in time, so the decal landed off-tooth or got
  // clipped. Switched to a simple 3D-bulge approach below that's
  // guaranteed visible from any angle.)

  // Build a single phase-aware material and apply it to every mesh inside
  // the cloned OBJ tree. Re-runs whenever the phase data or texture changes.
  useEffect(() => {
    const useTexture = !phaseData.crownCap && diffuseMap;
    const material = new THREE.MeshPhysicalMaterial({
      map: useTexture ? diffuseMap : null,
      color: new THREE.Color(surfaceColor),
      roughness: phaseData.crownCap ? 0.18 : 0.45,
      clearcoat: phaseData.crownCap ? 0.9 : 0.2,
      clearcoatRoughness: phaseData.crownCap ? 0.08 : 0.45,
      metalness: 0,
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity,
    });
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
      }
    });
    return () => material.dispose();
  }, [clone, diffuseMap, surfaceColor, emissiveColor, emissiveIntensity, phaseData.crownCap]);

  return (
    <group>
      {/* The REAL tooth — full OBJ tree. Centering, scaling, and right-side
          mirroring are baked into the clone's transform above, so we render
          it without any further parent-group adjustments. */}
      <primitive object={clone} />

      {/* Hyper-realistic cavity bulge — a small dark hemispherical bulge
          poking up through the chewing surface, with the cariesTexture
          mapped onto a flat disc on top of it. The 3D bulge is visible
          from any rotation angle (unlike a flat plane), and the textured
          disc gives the unmistakable black-bacteria-with-crack-lines
          look when viewed from above. */}
      {phaseData.caries > 0.15 && !phaseData.crownCap && bbSize && (
        <group position={[0, bbTopY * 0.92, 0]}>
          {/* Underlying dark cavity bulge — 3D so it's visible from the
              side too. Positioned slightly INSIDE the tooth so the rim
              hugs the chewing surface like an actual lesion. */}
          <mesh position={[0, -stainRadius * 0.25, 0]}>
            <sphereGeometry args={[stainRadius * 0.95, 24, 16]} />
            <meshStandardMaterial
              color="#0a0301"
              roughness={1.0}
              metalness={0}
            />
          </mesh>
          {/* Surface stain disc on top — the textured "black bacteria
              with crack lines" pattern, sitting flat on the cavity. */}
          {cariesTexture && (
            <mesh position={[0, stainRadius * 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
              <circleGeometry args={[stainRadius * 1.1, 32]} />
              <meshStandardMaterial
                map={cariesTexture}
                transparent
                opacity={0.96}
                side={THREE.DoubleSide}
                depthWrite={false}
                roughness={0.95}
              />
            </mesh>
          )}
          {/* Small angry-red glow at the very center for pulpitis/abscess */}
          {phaseData.caries > 0.85 && (
            <mesh>
              <sphereGeometry args={[stainRadius * 0.35, 16, 12]} />
              <meshStandardMaterial
                color="#3a0000"
                emissive="#5a0000"
                emissiveIntensity={0.6}
                transparent
                opacity={0.85}
              />
            </mesh>
          )}
        </group>
      )}

      {/* Access cavity (RCT prep) — small black drilled-out hole on the
          chewing surface. Same 3D-bulge logic for guaranteed visibility. */}
      {phaseData.accessHole && bbSize && (
        <group position={[0, bbTopY * 0.92, 0]}>
          <mesh position={[0, -bbSize[0] * 0.05, 0]}>
            <cylinderGeometry args={[bbSize[0] * 0.16, bbSize[0] * 0.18, bbSize[0] * 0.2, 24]} />
            <meshStandardMaterial color="#000" roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* Hyper-realistic caries stain: dark central pit with branching black
   fissure cracks radiating outward, plus scattered specks of darker decay.
   Rendered to a CanvasTexture so we can map it onto a circular plane on
   the occlusal surface — much more convincing than a solid dark disc. */
function makeCariesTexture(severity) {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2, cy = SIZE / 2;

  // Severity ramps how dark/large the cavity reads. Capped to 1.
  const sev = Math.min(1, Math.max(0, severity));
  const coreA = Math.min(1, 0.78 + sev * 0.22);
  const midA  = Math.min(1, 0.55 + sev * 0.4);
  const haloR = SIZE * (0.32 + sev * 0.18);

  // Soft brown halo — bleed of decay around the lesion
  const halo = ctx.createRadialGradient(cx, cy, 6, cx, cy, haloR);
  halo.addColorStop(0,   `rgba(40,18,4,${coreA})`);
  halo.addColorStop(0.45,`rgba(75,38,14,${midA})`);
  halo.addColorStop(1,   'rgba(120,70,30,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Branching black fissure cracks
  const drawFissure = (angle, length, width) => {
    ctx.strokeStyle = `rgba(8,4,0,${0.92})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    let x = cx, y = cy;
    const steps = 16;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const r = length * t;
      const a = angle + (Math.random() - 0.5) * 0.55;
      const wobble = (Math.random() - 0.5) * 18 * (1 - t);
      x = cx + Math.cos(a) * r + wobble;
      y = cy + Math.sin(a) * r + wobble;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  const numFissures = 6 + Math.round(sev * 4);
  for (let i = 0; i < numFissures; i++) {
    const angle = (i / numFissures) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const len = SIZE * (0.18 + sev * 0.22) * (0.7 + Math.random() * 0.6);
    const w = 7 + Math.random() * (8 + sev * 8);
    drawFissure(angle, len, w);
    drawFissure(angle, len * 0.7, w * 0.45);                 // inner darker streak
    if (Math.random() < 0.55) {
      drawFissure(angle + (Math.random() - 0.5) * 0.7, len * 0.45, w * 0.5); // branch
    }
  }

  // Re-darken the very center for depth (the pit at the bottom of the cavity)
  const pit = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.16);
  pit.addColorStop(0, 'rgba(0,0,0,1)');
  pit.addColorStop(0.6, 'rgba(15,5,2,0.85)');
  pit.addColorStop(1, 'rgba(15,5,2,0)');
  ctx.fillStyle = pit;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Scattered dark specks
  ctx.fillStyle = 'rgba(8,2,0,0.95)';
  for (let i = 0; i < 50; i++) {
    const r = SIZE * (0.05 + Math.random() * 0.30);
    const a = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function ToothLoadingFallback() {
  return (
    <Html center>
      <div style={{ color: '#6b7280', fontSize: 11, fontFamily: 'system-ui', whiteSpace: 'nowrap' }}>
        Loading 3D tooth model…
      </div>
    </Html>
  );
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
  const fileInfo = useMemo(() => getToothFileInfo(tooth), [tooth]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [toothReady, setToothReady] = useState(false);
  const handleToothReady = useCallback(() => setToothReady(true), []);

  // Reset the ready/playing/phase state whenever the popup re-targets.
  useEffect(() => {
    setToothReady(false);
    setPlaying(false);
    const startMap = {
      incipient: 1, enamel: 1,
      dentin: 2, deep_dentin: 3,
      pulp_exposure: 4,
    };
    setPhaseIdx(startMap[pathology?.depth] ?? 0);
  }, [pathology?.depth, pathology?.kind, tooth]);

  // Once the tooth OBJ has loaded, kick off the auto-play. For the
  // procedural fallback (no fileInfo), there's no async load — start
  // immediately so the popup isn't permanently paused.
  useEffect(() => {
    if (toothReady || !fileInfo) setPlaying(true);
  }, [toothReady, fileInfo]);

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
        background: '#0a0a12',
        border: `1.5px solid ${accent}55`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: `0 22px 60px rgba(0,0,0,0.85), 0 0 32px ${accent}33`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        pointerEvents: 'auto',
      }}
    >
      {/* Header — also acts as the drag handle when wrapped in
          <DraggablePopup>. The cursor + data attribute tell the wrapper
          that pointer events here should start a window drag. */}
      <div
        data-popup-drag-handle="true"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: isDisease ? 'rgba(220,38,38,0.08)' : 'rgba(16,185,129,0.08)',
          cursor: 'grab',
          userSelect: 'none',
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

      {/* 3D simulation — bigger canvas so the whole tooth fits comfortably.
          User can drag to rotate AND scroll to zoom; pan stays disabled so
          the tooth doesn't get pushed off-frame. Pulled the camera back a
          bit and widened the FOV slightly so the full crown + root render
          inside the canvas without clipping. */}
      <div style={{ height: 380, background: '#1c1c28' }}>
        <Canvas camera={{ position: [0, 4, 32], fov: 36 }}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[6, 12, 8]} intensity={1.6} />
          <directionalLight position={[-6, 6, -5]} intensity={0.7} color="#cce0ff" />
          <directionalLight position={[0, -8, 10]} intensity={0.4} color="#ffd9b5" />
          <Suspense fallback={<ToothLoadingFallback />}>
            {fileInfo ? (
              <RealToothModel
                fileInfo={fileInfo}
                anatomy={anatomy}
                phaseData={phaseData}
                onReady={handleToothReady}
              />
            ) : (
              <ToothModel anatomy={anatomy} phaseData={phaseData} />
            )}
          </Suspense>
          <OrbitControls
            target={[0, 0, 0]}
            enableRotate
            enableZoom
            enablePan={false}
            autoRotate={false}
            rotateSpeed={0.8}
            zoomSpeed={0.7}
            minDistance={18}
            maxDistance={55}
            minPolarAngle={Math.PI * 0.05}
            maxPolarAngle={Math.PI * 0.95}
          />
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
