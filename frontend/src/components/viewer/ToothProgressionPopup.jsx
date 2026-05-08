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
  // the clone's transform. Also detect which end of the bounding box is
  // the chewing surface (some Sketchfab teeth are modeled crown-up, some
  // crown-down) and pick a target mesh for raycast-based UV lookup.
  const { clone, bbSize, bbTopY, occlusalY, targetMesh } = useMemo(() => {
    const c = obj.clone(true);

    const box = new THREE.Box3().setFromObject(c);
    if (box.isEmpty()) {
      return { clone: c, bbSize: null, bbTopY: 0, occlusalY: 0, targetMesh: null };
    }

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxRoot = Math.max(...anatomy.roots.map((r) => r.length));
    const targetHeight = anatomy.crownH + maxRoot;
    const s = targetHeight / Math.max(size.y, 0.001);

    // Heuristic: the chewing surface (crown) has MORE vertex detail than
    // the smooth root. Count vertices in the top 25% of the bounding box
    // vs the bottom 25%. Whichever slab has more vertices is the crown.
    const topThresh = box.max.y - size.y * 0.25;
    const bottomThresh = box.min.y + size.y * 0.25;
    let topCount = 0, bottomCount = 0;
    c.traverse((child) => {
      if (!child.isMesh || !child.geometry?.attributes?.position) return;
      const pos = child.geometry.attributes.position;
      // Sample every Nth vertex for speed on dense meshes
      const step = Math.max(1, Math.floor(pos.count / 2000));
      for (let i = 0; i < pos.count; i += step) {
        const y = pos.getY(i);
        if (y >= topThresh) topCount++;
        else if (y <= bottomThresh) bottomCount++;
      }
    });
    const crownAtTop = topCount >= bottomCount;

    // Mirror right-side teeth, scale to target height, then translate so
    // the bbox center sits exactly at world origin.
    c.scale.set(fileInfo.mirror ? -s : s, s, s);
    c.position.set(-center.x * s * (fileInfo.mirror ? -1 : 1), -center.y * s, -center.z * s);
    c.updateMatrixWorld(true);

    // Pick the largest mesh in the tree as the raycast / UV target. The
    // crown is almost always the densest sub-mesh.
    let bestMesh = null, bestVertCount = 0;
    c.traverse((child) => {
      if (!child.isMesh || !child.geometry?.attributes?.position) return;
      const n = child.geometry.attributes.position.count;
      if (n > bestVertCount) { bestMesh = child; bestVertCount = n; }
    });

    const halfHeight = (size.y / 2) * s;
    return {
      clone: c,
      bbSize: [size.x * s, size.y * s, size.z * s],
      bbTopY: halfHeight,
      // World-Y of the chewing surface after centering. + halfHeight if crown
      // is at the top of the OBJ, - halfHeight if it's at the bottom.
      occlusalY: crownAtTop ? halfHeight : -halfHeight,
      targetMesh: bestMesh,
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
  // Stage hint for the painted cavity — drives which clinical look the
  // canvas painter renders (white-spot / brown stain / cavitation /
  // pulp-breach). Mirrors the phase severity bands.
  const cariesStage = phaseData.caries <= 0.32 ? 'enamel'
                    : phaseData.caries <= 0.6  ? 'dentin'
                    : phaseData.caries <= 0.85 ? 'deep'
                    : 'pulp';
  const cariesTexture = useMemo(
    () => (sevBucket > 0 ? makeCariesTexture(sevBucket / 4, cariesStage) : null),
    [sevBucket, cariesStage]
  );
  useEffect(() => () => { cariesTexture && cariesTexture.dispose(); }, [cariesTexture]);

  // Companion NORMAL MAP for the cavity — encodes a bowl-shaped depression
  // so the painted lesion is lit like a real sunken crater (rim catches
  // highlights, pit goes dark in shadow).
  const cariesNormalMap = useMemo(
    () => (sevBucket > 0 ? makeCariesNormalMap(sevBucket / 4, cariesStage) : null),
    [sevBucket, cariesStage]
  );
  useEffect(() => () => { cariesNormalMap && cariesNormalMap.dispose(); }, [cariesNormalMap]);

  // ── Cavity ETCHED INTO the tooth's actual diffuse texture ──
  // Raycast from outside the chewing surface inward to find the UV
  // coordinate at the cusp center. Then composite the cariesTexture
  // into a clone of the diffuse map at that UV. The result becomes the
  // tooth's actual surface texture — the cavity wraps the curvature
  // exactly because it's part of the material, not a separate mesh.
  const occlusalUV = useMemo(() => {
    if (!targetMesh || !occlusalY) return null;
    try {
      const dir = Math.sign(occlusalY) || 1;
      const rayOrigin = new THREE.Vector3(0, occlusalY + dir * 4, 0);
      const rayDir = new THREE.Vector3(0, -dir, 0);
      const raycaster = new THREE.Raycaster();
      raycaster.set(rayOrigin, rayDir);
      const hits = raycaster.intersectObject(targetMesh, false);
      if (!hits.length || !hits[0].uv) return null;
      return { x: hits[0].uv.x, y: hits[0].uv.y };
    } catch {
      return null;
    }
  }, [targetMesh, occlusalY]);

  // Build the painted diffuse: original diffuse + cavity texture stamped
  // at the occlusal UV. Re-bakes when severity bucket / diffuse / UV change.
  const paintedDiffuse = useMemo(() => {
    if (!diffuseMap?.image || !cariesTexture?.image) return null;
    if (phaseData.crownCap || phaseData.caries < 0.15) return null;
    try {
      const img = diffuseMap.image;
      const W = img.width || img.naturalWidth || 1024;
      const H = img.height || img.naturalHeight || 1024;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Original tooth texture
      ctx.drawImage(img, 0, 0, W, H);

      // Stamp cavity at the occlusal UV (or center of the texture as a
      // sane fallback if the raycast didn't return a UV — the chewing
      // surface is usually unwrapped near the texture's center).
      const cariesImg = cariesTexture.image;
      const stampSize = Math.min(W, H) * 0.32 * Math.min(1, phaseData.caries);
      const ux = occlusalUV ? occlusalUV.x : 0.5;
      const uy = occlusalUV ? occlusalUV.y : 0.5;
      const cx = ux * W;
      const cy = (1 - uy) * H;
      // Multiply blend so the cavity darkens the underlying enamel (looks
      // etched into the tooth instead of pasted on top).
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(cariesImg, cx - stampSize / 2, cy - stampSize / 2, stampSize, stampSize);
      ctx.globalCompositeOperation = 'source-over';

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = diffuseMap.flipY;
      tex.wrapS = diffuseMap.wrapS;
      tex.wrapT = diffuseMap.wrapT;
      tex.needsUpdate = true;
      return tex;
    } catch {
      return null;
    }
  }, [diffuseMap, cariesTexture, occlusalUV, phaseData.crownCap, phaseData.caries]);
  useEffect(() => () => { paintedDiffuse && paintedDiffuse.dispose(); }, [paintedDiffuse]);

  // Build a NORMAL MAP at diffuse-texture resolution: flat (128,128,255)
  // everywhere except the cavity region, where the bowl-indent normal
  // map is stamped at the same UV the diffuse cavity uses. With both
  // applied to MeshPhysicalMaterial, the cavity reads as a real
  // sunken crater under lighting — not just a printed dark patch.
  const paintedNormal = useMemo(() => {
    if (!cariesNormalMap?.image) return null;
    if (phaseData.crownCap || phaseData.caries < 0.15) return null;
    try {
      // Match diffuse texture size when we have one, else a sensible default
      const W = diffuseMap?.image?.width  || diffuseMap?.image?.naturalWidth  || 1024;
      const H = diffuseMap?.image?.height || diffuseMap?.image?.naturalHeight || 1024;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      // Flat tangent-space normal everywhere — RGB(128,128,255) means "no
      // displacement, normal points straight out of the surface".
      ctx.fillStyle = 'rgb(128,128,255)';
      ctx.fillRect(0, 0, W, H);

      // Stamp the cavity normal map at the same UV the diffuse uses.
      const stampSize = Math.min(W, H) * 0.32 * Math.min(1, phaseData.caries);
      const ux = occlusalUV ? occlusalUV.x : 0.5;
      const uy = occlusalUV ? occlusalUV.y : 0.5;
      const cx = ux * W;
      const cy = (1 - uy) * H;
      ctx.drawImage(cariesNormalMap.image, cx - stampSize / 2, cy - stampSize / 2, stampSize, stampSize);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.NoColorSpace;            // normal map = linear, never sRGB
      tex.flipY = diffuseMap?.flipY ?? true;
      tex.wrapS = diffuseMap?.wrapS ?? THREE.ClampToEdgeWrapping;
      tex.wrapT = diffuseMap?.wrapT ?? THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return tex;
    } catch {
      return null;
    }
  }, [diffuseMap, cariesNormalMap, occlusalUV, phaseData.crownCap, phaseData.caries]);
  useEffect(() => () => { paintedNormal && paintedNormal.dispose(); }, [paintedNormal]);

  // Build a single phase-aware material and apply it to every mesh inside
  // the cloned OBJ tree. Uses the cavity-painted diffuse when available
  // (so the cavity is etched into the tooth's surface), else the original.
  // Crown cap = ceramic crown, full opaque + glossy. Natural tooth = enamel
  // with a small amount of transmission so the pulpitis glow can read
  // faintly through the crown.
  useEffect(() => {
    const useTexture = !phaseData.crownCap;
    const mapTex = useTexture ? (paintedDiffuse || diffuseMap || null) : null;
    const material = new THREE.MeshPhysicalMaterial({
      map: mapTex,
      // Cavity normal map — adds 3D crater depth inside the lesion area
      // only. Outside the cavity the texture is flat-blue (no effect).
      normalMap: phaseData.crownCap ? null : (paintedNormal || null),
      normalScale: new THREE.Vector2(1.0, 1.0),
      color: new THREE.Color(surfaceColor),
      // Ceramic restoration = very smooth, high clearcoat. Natural enamel
      // = slight surface roughness with a thin clearcoat for wet sheen.
      roughness: phaseData.crownCap ? 0.12 : 0.42,
      clearcoat: phaseData.crownCap ? 1.0 : 0.35,
      clearcoatRoughness: phaseData.crownCap ? 0.05 : 0.30,
      reflectivity: phaseData.crownCap ? 0.65 : 0.5,
      metalness: 0,
      // Subtle enamel translucency — enough to let the inner pulpitis
      // glow bleed through the crown but not so much that the tooth
      // becomes ghostly. Disabled on full ceramic crown.
      transmission: phaseData.crownCap ? 0 : 0.08,
      ior: 1.55,
      thickness: 0.5,
      attenuationDistance: 4,
      attenuationColor: new THREE.Color('#f5e6c0'),
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
  }, [clone, diffuseMap, paintedDiffuse, paintedNormal, surfaceColor, emissiveColor, emissiveIntensity, phaseData.crownCap]);

  // ── In-tooth disease overlays: anatomically meaningful effects that
  //    play through the existing OBJ as the disease progresses.
  //
  //  • pulpitis glow        — pulsing red volume centered roughly at the
  //                           pulp chamber, visible through the slightly
  //                           translucent crown so the patient sees WHY
  //                           the tooth hurts.
  //  • periapical lesion    — dim red bone-loss halo at the root apex
  //                           when the abscess phase fires.
  //  • gutta-percha fill    — rust-coloured cone inside the root canal
  //                           during obturation. Strictly contained
  //                           within the root volume so it can never
  //                           protrude past the apex.
  //  • access pit           — small dark drilled cavity on the chewing
  //                           surface during endodontic access.
  //
  //  All internal overlays are hidden during the crown-cap (post-
  //  restoration) phase so the patient sees a clean restored tooth.
  const dir = Math.sign(occlusalY) || 1;                   // +1 crown up, -1 crown down
  const apexY = -occlusalY * 0.95;                         // root tip world-Y
  const pulpY = occlusalY * 0.55;                          // approx. pulp chamber world-Y
  const showPulp    = !phaseData.crownCap && (phaseData.pulpEmissive > 0.2 || phaseData.caries > 0.85);
  const showApical  = !phaseData.crownCap && phaseData.apicalLesion > 0.1;
  const showGutta   = !phaseData.crownCap && phaseData.gutta > 0;
  // Gutta-percha geometry — sized so its full extent stays INSIDE the
  // root region (between the cementoenamel junction and the apex). Never
  // protrudes past the tooth's silhouette.
  const rootHalf   = Math.abs(occlusalY);                  // half the OBJ height = root length-ish
  const guttaCenterY = -occlusalY / 2;                     // midway between origin and apex
  const guttaLength  = rootHalf * 0.78;                    // 78% of root, leaves clearance at apex + crown

  return (
    <group>
      {/* The REAL tooth — full OBJ tree. Centering, scaling, and right-side
          mirroring are baked into the clone's transform above. */}
      <primitive object={clone} />

      {/* Pulpitis glow — soft pulsing red sphere INSIDE the crown so it
          shows through the slightly translucent enamel. Patients can
          literally see the inflamed pulp. */}
      {showPulp && bbSize && (
        <PulpitisGlow
          position={[0, pulpY, 0]}
          radius={Math.min(bbSize[0], bbSize[2]) * 0.28}
          intensity={Math.min(1.2, phaseData.pulpEmissive * 1.8 + (phaseData.caries > 0.85 ? 0.5 : 0))}
        />
      )}

      {/* Periapical lesion — dim dark-red halo around the root apex. */}
      {showApical && bbSize && (
        <mesh position={[0, apexY - dir * Math.min(bbSize[1], 12) * 0.06, 0]}>
          <sphereGeometry args={[Math.min(bbSize[0], bbSize[2]) * 0.42 * (0.6 + phaseData.apicalLesion * 0.6), 24, 16]} />
          <meshStandardMaterial
            color="#5a1208"
            emissive="#3a0a04"
            emissiveIntensity={0.5}
            transparent
            opacity={0.6 * Math.min(1, phaseData.apicalLesion * 1.3)}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      )}

      {/* Gutta-percha — rust-coloured cone fully INSIDE the root canal.
          Aligned along the long axis with its tip at (or just shy of)
          the apex, base near the pulp-chamber level. Cannot protrude
          past the tooth silhouette. */}
      {showGutta && bbSize && (
        <mesh
          position={[0, guttaCenterY, 0]}
          rotation={[dir > 0 ? Math.PI : 0, 0, 0]}
        >
          <coneGeometry args={[Math.min(bbSize[0], bbSize[2]) * 0.07, guttaLength, 18]} />
          <meshStandardMaterial
            color="#c9551c"
            emissive="#5a1f08"
            emissiveIntensity={0.25}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
      )}

      {/* Endodontic access pit — small darkened cavity on the chewing
          surface. Hidden once the tooth is crowned. */}
      {phaseData.accessHole && !phaseData.crownCap && bbSize && (
        <mesh
          position={[0, occlusalY * 0.99, 0]}
          rotation={[dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <circleGeometry args={[Math.min(bbSize[0], bbSize[2]) * 0.16, 32]} />
          <meshStandardMaterial
            color="#0a0604"
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
            roughness={1}
          />
        </mesh>
      )}
    </group>
  );
}

/* Soft pulsing red glow used to visualize inflamed pulp tissue inside
   the crown. Pulses gently so the inflammation reads as "alive". */
function PulpitisGlow({ position, radius, intensity }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.06;
    ref.current.scale.set(s, s, s);
    if (ref.current.material) {
      ref.current.material.emissiveIntensity = intensity * (0.85 + Math.sin(clock.elapsedTime * 2.2) * 0.15);
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[radius, 24, 18]} />
      <meshStandardMaterial
        color="#a01408"
        emissive="#d41c08"
        emissiveIntensity={intensity}
        transparent
        opacity={0.55}
        depthWrite={false}
        roughness={1}
      />
    </mesh>
  );
}

/* Photographic-style cavity diffuse texture. NO stroke lines, NO discrete
   specks, NO marker-style scribbles — only smooth overlapping organic
   gradients + pixel-level noise so the result reads as a real biological
   lesion when `multiply`-blended into the tooth's diffuse map.

   Stage progression mirrors actual clinical caries:
     enamel    → chalky white-spot (early demineralization, no cavitation)
     dentin    → soft brown stained patch with a faint darker core
     deep      → pronounced brown lesion + clearly cavitated black core
     pulp      → fully cavitated, breach to pulp with red inflamed rim
─────────────────────────────────────────────────────────────────────── */
function makeCariesTexture(severity, stageHint /* 'enamel' | 'dentin' | 'deep' | 'pulp' */) {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2, cy = SIZE / 2;

  const sev = Math.min(1, Math.max(0, severity));
  const stage = stageHint
    || (sev <= 0.3 ? 'enamel'
        : sev <= 0.55 ? 'dentin'
        : sev <= 0.85 ? 'deep'
        : 'pulp');

  // Stage-specific palette
  let halo, mid, core, hasPit, pitR;
  if (stage === 'enamel') {
    halo = 'rgba(220,205,170,0.55)';   // chalky off-white
    mid  = 'rgba(170,135,90,0.5)';
    core = 'rgba(110,70,35,0.4)';
    hasPit = false;
    pitR   = 0;
  } else if (stage === 'dentin') {
    halo = 'rgba(110,65,28,0.65)';
    mid  = 'rgba(55,28,10,0.85)';
    core = 'rgba(20,8,2,0.95)';
    hasPit = true;
    pitR   = SIZE * 0.10;
  } else if (stage === 'deep') {
    halo = 'rgba(70,35,12,0.85)';
    mid  = 'rgba(22,10,2,0.95)';
    core = 'rgba(0,0,0,1)';
    hasPit = true;
    pitR   = SIZE * 0.16;
  } else { // pulp / abscess
    halo = 'rgba(45,20,5,0.95)';
    mid  = 'rgba(8,3,0,1)';
    core = 'rgba(0,0,0,1)';
    hasPit = true;
    pitR   = SIZE * 0.20;
  }

  // ── Organic OUTER halo: 16 overlapping irregular radial gradients at
  //    randomized offsets give the lesion an amoeba-like outline that
  //    fades smoothly into the enamel — no clean circle anywhere.
  const haloR = SIZE * 0.34 * (stage === 'pulp' ? 1.2 : stage === 'deep' ? 1.1 : 1.0);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.5;
    const off = haloR * (0.10 + Math.random() * 0.30);
    const ox = cx + Math.cos(ang) * off;
    const oy = cy + Math.sin(ang) * off;
    const r = haloR * (0.40 + Math.random() * 0.40);
    const g = ctx.createRadialGradient(ox, oy, 1, ox, oy, r);
    g.addColorStop(0,   halo);
    g.addColorStop(0.5, mid);
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Inner darker zone (necrotic dentin / cavitated tissue). Same
  //    multi-blob technique so the inner border is irregular too.
  const midR = haloR * 0.55;
  for (let i = 0; i < 10; i++) {
    const ang = Math.random() * Math.PI * 2;
    const off = midR * Math.random() * 0.35;
    const ox = cx + Math.cos(ang) * off;
    const oy = cy + Math.sin(ang) * off;
    const r = midR * (0.50 + Math.random() * 0.45);
    const g = ctx.createRadialGradient(ox, oy, 1, ox, oy, r);
    g.addColorStop(0,   mid);
    g.addColorStop(0.7, core);
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Central cavitation pit (dentin / deep / pulp only). The actual
  //    "hole" punched through the enamel.
  if (hasPit) {
    const r = pitR * (0.85 + sev * 0.35);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,   'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(5,2,0,0.92)');
    g.addColorStop(1,   'rgba(15,6,2,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Pulp/abscess breach — faint dark-red rim around the pit suggesting
  //    inflamed pulp visible through the cavitation.
  if (stage === 'pulp') {
    const g = ctx.createRadialGradient(cx, cy, pitR * 0.45, cx, cy, pitR * 1.5);
    g.addColorStop(0,   'rgba(0,0,0,0)');
    g.addColorStop(0.45,'rgba(125,15,5,0.55)');
    g.addColorStop(1,   'rgba(125,15,5,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Pixel-level organic noise. Adds the porous/rough surface look
  //    without any visible "lines" or "specks" — pure micro-variation
  //    only on the painted area, transparent areas are left alone so
  //    the lesion still has a soft fade-out edge.
  const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 30) continue;
    const n = (Math.random() - 0.5) * 22;
    data[i]     = Math.max(0, Math.min(255, data[i]     + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 0.7));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.5));
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* Companion NORMAL MAP for the cavity. Encodes a bowl-shaped depression
   so PBR lighting actually treats the painted area as a sunken crater —
   the rim catches highlights, the pit goes dark in shadow. This is what
   makes the lesion read as a 3D cavity instead of a printed graphic.

   Returns a CanvasTexture in linear color space (REQUIRED for normalMap). */
function makeCariesNormalMap(severity, stageHint) {
  const SIZE = 256;                                          // smaller is fine, gets bilinearly filtered
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(SIZE, SIZE);
  const data = imageData.data;

  const sev = Math.min(1, Math.max(0, severity));
  const stage = stageHint
    || (sev <= 0.3 ? 'enamel'
        : sev <= 0.55 ? 'dentin'
        : sev <= 0.85 ? 'deep'
        : 'pulp');

  const cx = SIZE / 2, cy = SIZE / 2;

  // Bowl size + depth-strength per stage. Enamel barely indents; pulp is
  // a deep crater with steep walls.
  let bowlR, depthScale;
  if (stage === 'enamel')      { bowlR = SIZE * 0.30; depthScale = 0.35; }
  else if (stage === 'dentin') { bowlR = SIZE * 0.32; depthScale = 0.85; }
  else if (stage === 'deep')   { bowlR = SIZE * 0.36; depthScale = 1.4; }
  else                          { bowlR = SIZE * 0.40; depthScale = 1.8; }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r  = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * SIZE + x) * 4;

      // Subtle perturbation of the bowl edge so the rim isn't a perfect
      // circle — every cavity in real life is irregular.
      const angle = Math.atan2(dy, dx);
      const wobble = Math.sin(angle * 3) * 0.06 + Math.cos(angle * 5) * 0.04;
      const effR = bowlR * (1 + wobble);

      let nx = 0, ny = 0, nz = 1;
      if (r < effR && r > 0.5) {
        // Bowl profile: y(r) = depth * (r/R)^2 - depth (so r=0 is deepest).
        // Slope dy/dr = 2 * depth * r / R^2 (positive — going outward = up).
        // Surface normal in (radial, axial) = (-slope, 1).
        // The radial direction in 2D pixel space is (dx/r, dy/r).
        const slope = 2 * depthScale * r / (effR * effR);
        const radX = dx / r;
        const radY = dy / r;
        // Normal points OUT-AND-UP for a depression: tilts toward the
        // cavity center horizontally + up axially.
        nx = -slope * radX;
        ny = -slope * radY;
        nz = 1;
        const m = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= m; ny /= m; nz /= m;
      }

      // Encode normal to RGB (-1..1 → 0..255)
      data[idx]     = Math.round((nx + 1) * 127.5);
      data[idx + 1] = Math.round((ny + 1) * 127.5);
      data[idx + 2] = Math.round(nz * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  // Normal maps MUST be sampled in linear color space, never sRGB.
  tex.colorSpace = THREE.NoColorSpace;
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
        <Canvas camera={{ position: [0, 4, 32], fov: 36 }} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
          {/* Cinematic medical lighting on the tooth: a strong key light
              from upper-right, a cool fill from the opposite side, a warm
              underbite bounce, and a soft cool rim for separation. */}
          <ambientLight intensity={0.85} />
          <directionalLight position={[6, 12, 8]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-6, 6, -5]} intensity={0.7} color="#cce0ff" />
          <directionalLight position={[0, -8, 10]} intensity={0.4} color="#ffd9b5" />
          <directionalLight position={[0, 4, -14]} intensity={0.55} color="#e0eaff" />
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
