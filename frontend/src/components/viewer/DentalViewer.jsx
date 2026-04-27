import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useThree, useLoader, useFrame as useFrameImpl } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Center, Line } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import ToothOverlay, { RealisticTooth } from './ToothOverlay';
import ToothProgressionPopup from './ToothProgressionPopup';

/* ── Same PLY UV extractor as ScanPreview3D ─────────────────── */
async function extractPLYExtras(url) {
  try {
    const resp = await fetch(url);
    const buffer = await resp.arrayBuffer();
    const preview = new TextDecoder().decode(new Uint8Array(buffer, 0, 4096));
    const headerEnd = preview.indexOf('end_header');
    if (headerEnd === -1) return { colors: null, uvs: null };
    const headerText = preview.slice(0, headerEnd + 'end_header'.length);
    if (!headerText.includes('binary_little_endian')) return { colors: null, uvs: null };
    const lines = headerText.split(/\r?\n/);
    let vertexCount = 0;
    const props = [];
    let inVertex = false;
    const SIZES = { char:1,uchar:1,short:2,ushort:2,int:4,uint:4,float:4,double:8 };
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0]==='element'&&parts[1]==='vertex'){vertexCount=parseInt(parts[2]);inVertex=true;continue;}
      if (parts[0]==='element'&&parts[1]!=='vertex'){inVertex=false;continue;}
      if (inVertex&&parts[0]==='property'&&parts[1]!=='list') props.push({type:parts[1],name:parts[2]});
    }
    if (!vertexCount||!props.length) return { colors: null, uvs: null };
    const hasDR = props.some(p=>p.name==='diffuse_red');
    const hasR  = props.some(p=>p.name==='red');
    const hasU  = props.some(p=>p.name==='texture_u'||p.name==='s');
    const hasV  = props.some(p=>p.name==='texture_v'||p.name==='t');
    if (!hasDR&&!hasR&&!hasU) return { colors: null, uvs: null };
    const rawBytes = new Uint8Array(buffer);
    const enc = new TextEncoder();
    const markerNL = enc.encode('end_header\n');
    const markerCR = enc.encode('end_header\r\n');
    let dataOffset = -1;
    for (let i=0;i<rawBytes.length-markerNL.length;i++) {
      let mNL=true;
      for (let j=0;j<markerNL.length;j++) if(rawBytes[i+j]!==markerNL[j]){mNL=false;break;}
      if(mNL){dataOffset=i+markerNL.length;break;}
      if(i<rawBytes.length-markerCR.length){
        let mCR=true;
        for(let j=0;j<markerCR.length;j++) if(rawBytes[i+j]!==markerCR[j]){mCR=false;break;}
        if(mCR){dataOffset=i+markerCR.length;break;}
      }
    }
    if (dataOffset===-1) return { colors: null, uvs: null };
    let stride=0; const off={};
    for (const p of props){off[p.name]=stride;stride+=(SIZES[p.type]||4);}
    const view = new DataView(buffer, dataOffset);
    const colors = (hasDR||hasR) ? new Float32Array(vertexCount*3) : null;
    const uvs    = (hasU&&hasV)  ? new Float32Array(vertexCount*2) : null;
    const rN=hasDR?'diffuse_red':'red', gN=hasDR?'diffuse_green':'green', bN=hasDR?'diffuse_blue':'blue';
    const uN=props.find(p=>p.name==='texture_u')?'texture_u':'s';
    const vN=props.find(p=>p.name==='texture_v')?'texture_v':'t';
    for (let i=0;i<vertexCount;i++) {
      const base=i*stride;
      if(colors){colors[i*3]=view.getUint8(base+off[rN])/255;colors[i*3+1]=view.getUint8(base+off[gN])/255;colors[i*3+2]=view.getUint8(base+off[bN])/255;}
      if(uvs){uvs[i*2]=view.getFloat32(base+off[uN],true);uvs[i*2+1]=view.getFloat32(base+off[vN],true);}
    }
    return { colors, uvs };
  } catch { return { colors: null, uvs: null }; }
}

function normalizeVertexColors(geo) {
  const col = geo.attributes.color;
  if (!col) return false;
  let max=0;
  for(let i=0;i<Math.min(col.count,128);i++) max=Math.max(max,col.getX(i),col.getY(i),col.getZ(i));
  if(max>1.5){const arr=col.array;for(let i=0;i<arr.length;i++)arr[i]/=255;col.needsUpdate=true;}
  return true;
}

/**
 * Main 3D Dental Viewer — loads real STL/PLY scans and overlays
 * disease/treatment simulations on specific teeth.
 *
 * Camera positioned for a front-facing clinical view looking slightly
 * down into the mouth — like a patient in the chair.
 */
export default function DentalViewer({ scanUrl, scanFormat, simulation, activeStateIndex, textureUrl, clinicalPathology, pickedTooth }) {
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
          <TreatmentJourney url={scanUrl} format={scanFormat} textureUrl={textureUrl} simulation={simulation} activeStateIndex={activeStateIndex} clinicalPathology={clinicalPathology} pickedTooth={pickedTooth} />
        ) : (
          <PlaceholderArch simulation={simulation} activeStateIndex={activeStateIndex} clinicalPathology={clinicalPathology} pickedTooth={pickedTooth} />
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
/**
 * Paints realistic tooth + gum colors directly onto the mesh as vertex colors.
 *   • Top of mesh        → cream-white teeth
 *   • Side / lower mesh  → pink gingiva
 *   • Smooth blend at the gum line with per-vertex variation for realism
 *
 * Auto-detects whether the arch is upper (teeth at bottom) or lower (teeth
 * at top) by checking which end has more "pointy" peaks (cusps).
 */
function applyProceduralDentalColors(geo) {
  const positions = geo.attributes.position;
  const normals = geo.attributes.normal;
  const count = positions.count;

  const minY = geo.boundingBox.min.y;
  const maxY = geo.boundingBox.max.y;
  const range = Math.max(0.0001, maxY - minY);

  // Detect arch orientation: teeth point AWAY from the gum side.
  // Sample a few hundred normals and see whether more point up or down.
  let upCount = 0, downCount = 0;
  const step = Math.max(1, Math.floor(count / 500));
  for (let i = 0; i < count; i += step) {
    const ny = normals.getY(i);
    if (ny > 0.5) upCount++;
    else if (ny < -0.5) downCount++;
  }
  const teethAtTop = upCount >= downCount;

  // Realistic clinical color palette
  const enamel  = new THREE.Color('#f5ecd8'); // cream-white tooth
  const enamel2 = new THREE.Color('#ede0c5'); // slightly more yellow for variation
  const gum     = new THREE.Color('#cc6677'); // healthy pink gingiva
  const gum2    = new THREE.Color('#a04050'); // deeper pink for shadows
  const sulcus  = new THREE.Color('#7a2030'); // dark red at the gum line

  const colors = new Float32Array(count * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const y = positions.getY(i);
    // tNorm: 0 = gum end, 1 = tooth end
    let tNorm = (y - minY) / range;
    if (!teethAtTop) tNorm = 1 - tNorm;

    let baseColor;
    if (tNorm > 0.62) {
      // Tooth zone — cream with subtle yellow variation
      const v = (Math.sin(positions.getX(i) * 7) + Math.cos(positions.getZ(i) * 7)) * 0.5 + 0.5;
      baseColor = enamel.clone().lerp(enamel2, v * 0.4);
    } else if (tNorm > 0.5) {
      // Gum line transition — dark red
      const blend = (tNorm - 0.5) / 0.12; // 0 → 1 across the band
      baseColor = sulcus.clone().lerp(enamel, blend * blend);
    } else if (tNorm > 0.25) {
      // Attached gingiva — pink with some variation
      const v = Math.abs(Math.sin(positions.getX(i) * 3 + positions.getZ(i) * 3));
      baseColor = gum.clone().lerp(gum2, v * 0.3);
    } else {
      // Apical / root area — deeper pink fading to dark
      const blend = tNorm / 0.25;
      baseColor = gum2.clone().lerp(gum, blend);
    }

    // Tiny per-vertex luminosity noise for organic feel
    const noise = (Math.random() - 0.5) * 0.04;
    tmp.copy(baseColor);
    colors[i * 3]     = Math.max(0, Math.min(1, tmp.r + noise));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, tmp.g + noise * 0.8));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, tmp.b + noise * 0.8));
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/* ──────────────────────────────────────────────────────────────────────
   makeStainTexture — procedurally renders a 2D pathology/treatment patch
   to a canvas, returns a CanvasTexture suitable for projecting as a DECAL
   onto the real scan mesh. The decal wraps to the tooth's actual surface
   so the stain looks BAKED IN, not glued on top.

   Inspired by the clinical look of dental textbook photos: dark brown
   organic stain following the fissures for caries, smooth tooth-colored
   patch for composite fillings, glossy ceramic for crowns, etc.
─────────────────────────────────────────────────────────────────────── */
function makeStainTexture(kind, stage, treatment) {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2, cy = SIZE / 2;

  // Helper — a jagged dark line radiating from center, like a stained fissure
  const drawFissure = (angle, length, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    let x = cx, y = cy;
    const steps = 14;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const r = length * t;
      const a = angle + (Math.random() - 0.5) * 0.45;
      const wobble = (Math.random() - 0.5) * 22 * (1 - t);
      x = cx + Math.cos(a) * r + wobble;
      y = cy + Math.sin(a) * r + wobble;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // ── CARIES — dark brown organic stain that LOOKS like decay in fissures
  if (kind === 'caries') {
    const palettes = {
      enamel:      { core: 'rgba(110,75,30,0.85)', mid: 'rgba(135,90,45,0.7)',  edge: 'rgba(170,130,80,0.0)' },
      dentin:      { core: 'rgba(35,15,4,0.96)',   mid: 'rgba(75,38,14,0.88)',  edge: 'rgba(120,70,30,0.0)' },
      deep_dentin: { core: 'rgba(12,4,0,0.98)',    mid: 'rgba(45,18,4,0.92)',   edge: 'rgba(100,55,20,0.0)' },
      pulp:        { core: 'rgba(0,0,0,1)',        mid: 'rgba(40,8,5,0.95)',    edge: 'rgba(95,35,15,0.0)' },
      abscess:     { core: 'rgba(0,0,0,1)',        mid: 'rgba(80,15,5,0.95)',   edge: 'rgba(160,40,20,0.0)' },
    };
    const pal = palettes[stage] || palettes.dentin;

    // Outer halo — soft brown shadow
    const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, SIZE * 0.42);
    grad.addColorStop(0,   pal.core);
    grad.addColorStop(0.4, pal.mid);
    grad.addColorStop(1,   pal.edge);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Branching dark fissures — like decay tracking along grooves
    const numFissures = stage === 'enamel' ? 4 : 7;
    for (let i = 0; i < numFissures; i++) {
      const angle = (i / numFissures) * Math.PI * 2 + Math.random() * 0.6;
      const len = SIZE * (0.20 + Math.random() * 0.20);
      const w = 9 + Math.random() * 14;
      drawFissure(angle, len, w, pal.core);
      // Inner darker streak inside the fissure
      drawFissure(angle, len * 0.7, w * 0.45, pal.core);
    }

    // Re-darken the very center for depth
    const grad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.18);
    grad2.addColorStop(0, pal.core);
    grad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Scattered specks of darker decay
    ctx.fillStyle = pal.core;
    for (let i = 0; i < 35; i++) {
      const r = SIZE * 0.05 + Math.random() * SIZE * 0.32;
      const a = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pulp/abscess — angry red glow at the center
    if (stage === 'pulp' || stage === 'abscess') {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.10);
      rg.addColorStop(0, 'rgba(220,30,20,0.9)');
      rg.addColorStop(1, 'rgba(220,30,20,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
  }
  // ── COMPOSITE FILLING / INLAY / VENEER / SEALANT — tooth-colored smooth patch
  else if (kind === 'composite_filling' || kind === 'inlay' || kind === 'veneer' || kind === 'sealant') {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.45);
    grad.addColorStop(0,    'rgba(248,235,200,0.97)');
    grad.addColorStop(0.7,  'rgba(232,212,170,0.92)');
    grad.addColorStop(0.92, 'rgba(190,160,115,0.55)');
    grad.addColorStop(1,    'rgba(160,130,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Subtle margin ring (the bond line)
    ctx.strokeStyle = 'rgba(110,80,50,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, SIZE * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    // Tiny highlight
    const hi = ctx.createRadialGradient(cx - 50, cy - 50, 0, cx - 50, cy - 50, SIZE * 0.16);
    hi.addColorStop(0, 'rgba(255,255,255,0.35)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  // ── AMALGAM — dark silvery patch
  else if (kind === 'amalgam') {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.45);
    grad.addColorStop(0,    'rgba(70,72,78,0.98)');
    grad.addColorStop(0.6,  'rgba(48,50,56,0.95)');
    grad.addColorStop(0.92, 'rgba(28,28,32,0.7)');
    grad.addColorStop(1,    'rgba(20,20,25,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Metallic noise
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * SIZE, y = Math.random() * SIZE;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > (SIZE * 0.42) ** 2) continue;
      ctx.fillStyle = `rgba(150,155,165,${0.04 + Math.random() * 0.12})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // ── CROWN (any) — bright glossy ceramic or metal cap
  else if (kind === 'metal_crown' || kind === 'all_ceramic_crown' || kind === 'pfm_crown') {
    const isMetal = kind === 'metal_crown';
    const grad = ctx.createRadialGradient(cx - 40, cy - 40, 0, cx, cy, SIZE * 0.5);
    if (isMetal) {
      grad.addColorStop(0,    'rgba(245,245,250,1)');
      grad.addColorStop(0.5,  'rgba(180,185,195,1)');
      grad.addColorStop(0.85, 'rgba(120,125,135,0.85)');
      grad.addColorStop(1,    'rgba(90,95,105,0)');
    } else {
      grad.addColorStop(0,    'rgba(255,250,238,1)');
      grad.addColorStop(0.5,  'rgba(245,235,212,1)');
      grad.addColorStop(0.85, 'rgba(220,205,175,0.9)');
      grad.addColorStop(1,    'rgba(195,175,140,0)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Specular highlight
    const hi = ctx.createRadialGradient(cx - 70, cy - 70, 0, cx - 70, cy - 70, SIZE * 0.2);
    hi.addColorStop(0, 'rgba(255,255,255,0.55)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  // ── ROOT CANAL — rust/orange sealed access cavity
  else if (kind === 'rct') {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.45);
    grad.addColorStop(0,    'rgba(135,68,28,0.96)');
    grad.addColorStop(0.6,  'rgba(165,90,42,0.9)');
    grad.addColorStop(0.92, 'rgba(180,130,80,0.5)');
    grad.addColorStop(1,    'rgba(180,130,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Dark center — the sealed access opening
    const dark = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.13);
    dark.addColorStop(0, 'rgba(40,15,5,0.95)');
    dark.addColorStop(1, 'rgba(40,15,5,0)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  // ── EXTRACTION — dark red socket
  else if (kind === 'extraction') {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.45);
    grad.addColorStop(0,    'rgba(20,5,5,1)');
    grad.addColorStop(0.4,  'rgba(70,20,15,0.95)');
    grad.addColorStop(0.85, 'rgba(140,55,40,0.6)');
    grad.addColorStop(1,    'rgba(180,90,75,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function TreatmentJourney({ url, format, textureUrl, simulation, activeStateIndex, clinicalPathology, pickedTooth }) {
  const meshRef = useRef();
  const [scanMesh, setScanMesh] = useState(null);
  const [geometry, setGeometry] = useState(null);
  const [bbox, setBbox] = useState(null);
  const [hasUVs, setHasUVs] = useState(false);
  const [hasVertexColors, setHasVertexColors] = useState(false);
  const [texture, setTexture] = useState(null);

  // ── Load mesh (STL / PLY / OBJ) ─────────────────────────────
  useEffect(() => {
    const finishGeo = (geo) => {
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.center();
      geo.computeBoundingBox();
      const size = new THREE.Vector3();
      geo.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 22 / maxDim;
      geo.scale(scale, scale, scale);
      geo.computeBoundingBox();
      const finalSize = new THREE.Vector3();
      geo.boundingBox.getSize(finalSize);

      const hadVertexColors = !!(geo.attributes.color?.count > 0);
      const hasUVs = !!(geo.attributes.uv?.count > 0);

      setBbox({
        sizeX: finalSize.x,
        sizeY: finalSize.y,
        sizeZ: finalSize.z,
        topY: geo.boundingBox.max.y,
        frontZ: geo.boundingBox.max.z,
      });
      setHasUVs(hasUVs);
      setHasVertexColors(hadVertexColors);
      setGeometry(geo);
    };

    if (format === 'obj') {
      new OBJLoader().load(url, (group) => {
        let merged = null;
        group.traverse((child) => { if (child.isMesh && !merged) merged = child.geometry; });
        if (merged) finishGeo(merged);
      });
    } else if (format === 'ply') {
      extractPLYExtras(url).then(extras => {
        new PLYLoader().load(url, (g) => {
          if (extras?.colors && !(g.attributes.color?.count>0))
            g.setAttribute('color', new THREE.BufferAttribute(extras.colors, 3));
          if (extras?.uvs && !(g.attributes.uv?.count>0))
            g.setAttribute('uv', new THREE.BufferAttribute(extras.uvs, 2));
          normalizeVertexColors(g);
          finishGeo(g);
        });
      }).catch(() => new PLYLoader().load(url, finishGeo));
    } else {
      new STLLoader().load(url, finishGeo);
    }
  }, [url, format]);

  // ── Load color texture ──────────────────────────────────────
  useEffect(() => {
    if (!textureUrl) { setTexture(null); return; }
    new THREE.TextureLoader().load(textureUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true; // PLY UV coords use OpenGL convention — keep flipY=true
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 8;
      setTexture(tex);
    });
  }, [textureUrl]);

  const activeState = simulation?.states?.[activeStateIndex] || null;
  const styling = useMemo(() => getStageStyling(activeState), [activeState]);
  const simStage = activeState?.clinical_metrics?.stage;
  const simTreatment = activeState?.clinical_metrics?.treatment;
  const metrics = activeState?.clinical_metrics || {};

  // ── Derive effective stage/treatment from clinical pathology (overrides sim) ──
  const { effectiveStage, effectiveTreatment } = useMemo(() => {
    if (!clinicalPathology?.kind) {
      return { effectiveStage: simStage, effectiveTreatment: simTreatment };
    }
    const { kind, depth } = clinicalPathology;
    const depthToStage = { incipient: 'enamel', enamel: 'enamel', dentin: 'dentin', deep_dentin: 'dentin', pulp_exposure: 'pulp' };
    const kindToTreatment = {
      composite_filling: 'composite_filling', amalgam: 'composite_filling',
      inlay: 'composite_filling', sealant: 'composite_filling',
      all_ceramic_crown: 'zirconia_crown', pfm_crown: 'zirconia_crown',
      metal_crown: 'metal_crown', rct: 'root_canal', veneer: 'composite_filling',
    };
    if (kind === 'caries')    return { effectiveStage: depthToStage[depth] || 'dentin',    effectiveTreatment: null };
    if (kind === 'extraction') return { effectiveStage: 'extracted', effectiveTreatment: null };
    return { effectiveStage: 'restored', effectiveTreatment: kindToTreatment[kind] || 'composite_filling' };
  }, [clinicalPathology, simStage, simTreatment]);

  const isPulsing = ['pulp', 'abscess'].includes(effectiveStage);

  // ── Click-to-place overlay ──
  const [markerPos, setMarkerPos] = useState(null);
  const [markerNormal, setMarkerNormal] = useState(null);
  const [popupOpen, setPopupOpen] = useState(true);

  const handleClickScan = (e) => {
    e.stopPropagation();
    if (e.face && e.point) {
      setMarkerPos([e.point.x, e.point.y, e.point.z]);
      const n = e.face.normal.clone().transformDirection(meshRef.current.matrixWorld).normalize();
      setMarkerNormal([n.x, n.y, n.z]);
    }
  };

  // ── Reset marker when pathology is cleared ──
  useEffect(() => {
    if (!clinicalPathology?.kind) {
      setMarkerPos(null);
      setMarkerNormal(null);
    }
    setPopupOpen(true);
  }, [clinicalPathology?.kind, clinicalPathology?.depth, pickedTooth]);

  // ── Texture imperatively applied ──
  useEffect(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    mat.map = texture || null;
    mat.vertexColors = !texture && hasVertexColors;
    mat.color.set('#ffffff');
    mat.emissive.set('#000000');
    mat.emissiveIntensity = 0;
    mat.needsUpdate = true;
  }, [texture, hasVertexColors]);

  useFrameImpl(() => {});

  if (!geometry || !bbox) return <LoadingIndicator />;

  const meshDiag = Math.sqrt(bbox.sizeX**2 + bbox.sizeY**2 + bbox.sizeZ**2);
  const overlaySize = meshDiag * 0.032; // slightly larger for visibility

  const monthLabel  = activeState?.label?.split('—')[0]?.trim() || '';
  const detailLabel = activeState?.label?.split('—')[1]?.trim() || activeState?.label || '';

  const hasClinical = !!(clinicalPathology?.kind && pickedTooth);

  return (
    <group>
      {/* The scan mesh */}
      <mesh
        ref={(m) => { meshRef.current = m; if (m !== scanMesh) setScanMesh(m); }}
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={handleClickScan}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'crosshair'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <meshPhysicalMaterial
          color="#ffffff"
          map={texture || null}
          vertexColors={!texture && hasVertexColors}
          emissive="#000000"
          emissiveIntensity={0}
          roughness={0.48}
          metalness={0.03}
          clearcoat={0.1}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {/* Texture hint */}
      {!texture && !hasClinical && (
        <Html position={[0, bbox.topY + 2.5, 0]} center distanceFactor={22}>
          <div className="bg-black/70 text-gray-400 text-[10px] px-3 py-1.5 rounded-md whitespace-nowrap pointer-events-none border border-white/10">
            Drop colour JPEG anywhere to apply texture
          </div>
        </Html>
      )}

      {/* Click hint */}
      {!markerPos && (
        <Html position={[0, bbox.topY + (texture ? 2.5 : 4), 0]} center distanceFactor={22}>
          <div
            className="text-white text-[11px] font-semibold px-3 py-1.5 rounded-md whitespace-nowrap pointer-events-none shadow-lg"
            style={{ background: hasClinical ? '#f59e0b' : '#3b82f6', animation: hasClinical ? 'pulse 1.4s ease-in-out infinite' : 'none' }}
          >
            {hasClinical
              ? `👆 Click tooth #${pickedTooth} on the scan to place the ${clinicalPathology.kind === 'caries' ? 'cavity' : 'treatment'}`
              : '👆 Click any tooth on the scan to place a marker'}
          </div>
        </Html>
      )}

      {/* Clinical pathology badge — top of scan, always visible when panel is filled */}
      {hasClinical && (
        <Html position={[0, bbox.topY + (markerPos ? 3.5 : 6.5), 0]} center distanceFactor={22}>
          <ClinicalBadge pathology={clinicalPathology} tooth={pickedTooth} onReset={() => { setMarkerPos(null); setMarkerNormal(null); }} />
        </Html>
      )}

      {/* Pathology decal — projected onto the actual scan surface so it
          looks baked into the tooth, not glued on top. */}
      {markerPos && markerNormal && scanMesh && clinicalPathology?.kind && (
        <PathologyDecal
          mesh={scanMesh}
          position={markerPos}
          normal={markerNormal}
          size={overlaySize * 1.6}
          kind={clinicalPathology.kind}
          stage={effectiveStage}
          treatment={effectiveTreatment}
          pulsing={isPulsing}
        />
      )}

      {/* Disease → treatment progression popup, anchored next to the
          clicked tooth on the scan. Animates the full pathway:
          enamel → dentin → pulp → canals → periapex → endo treatment
          → gutta-percha → crown. Root anatomy varies by FDI tooth #. */}
      {markerPos && pickedTooth && clinicalPathology?.kind && popupOpen && (
        <Html position={markerPos} style={{ pointerEvents: 'none', transform: 'translate(40px, -50%)' }} zIndexRange={[100, 0]}>
          <ToothProgressionPopup
            tooth={pickedTooth}
            pathology={clinicalPathology}
            onClose={() => setPopupOpen(false)}
          />
        </Html>
      )}

      {/* Re-open popup tab if closed */}
      {markerPos && pickedTooth && clinicalPathology?.kind && !popupOpen && (
        <Html position={markerPos} style={{ pointerEvents: 'auto', transform: 'translate(40px, -50%)' }}>
          <button
            onClick={() => setPopupOpen(true)}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(220,38,38,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            ▶ Show progression
          </button>
        </Html>
      )}

      {/* Simulation timeline card — only when no clinical override */}
      {activeState && !hasClinical && (
        <Html position={[bbox.sizeX * 0.55 + 1, 0, 0]} distanceFactor={20} style={{ width: 220 }}>
          <div className="pointer-events-none select-none" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: styling.markerColor, boxShadow: `0 0 6px ${styling.markerColor}` }} />
              <span className="text-[12px] font-bold text-white">{styling.label}</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              {monthLabel && <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{monthLabel}</div>}
              {detailLabel && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{detailLabel}</div>}
            </div>
            {Object.keys(metrics).length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px' }}>
                {Object.entries(metrics).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#e5e7eb', textTransform: 'capitalize' }}>{String(v).replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
            {markerPos && (
              <button
                onClick={() => { setMarkerPos(null); setMarkerNormal(null); }}
                style={{ pointerEvents: 'auto', marginTop: 8, fontSize: 10, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: '100%' }}
              >
                Reset · Pick a different tooth
              </button>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   PathologyDecal — projects a 2D procedural stain texture onto the actual
   scan mesh using THREE.DecalGeometry. The decal wraps to the tooth's
   real surface curvature so the cavity/filling/crown looks BAKED INTO the
   scan, not floating on top.

   Material properties switch by pathology kind:
     • caries       → matte rough dark brown stain
     • amalgam      → dark metallic
     • crowns       → glossy ceramic/metal
     • composite    → tooth-colored matte
     • rct          → matte rust
     • extraction   → matte dark red socket
─────────────────────────────────────────────────────────────────────── */
function PathologyDecal({ mesh, position, normal, size, kind, stage, treatment, pulsing }) {
  const matRef = useRef();

  // Procedural stain texture — re-baked when the diagnosis changes
  const texture = useMemo(
    () => makeStainTexture(kind, stage, treatment),
    [kind, stage, treatment]
  );

  // Decal geometry — projected from `position` along `normal`, conforming
  // to the scan mesh's actual curvature.
  const decalGeometry = useMemo(() => {
    if (!mesh || !mesh.geometry) return null;
    try {
      const pos = new THREE.Vector3(...position);
      const n = new THREE.Vector3(...normal).normalize();

      // Build orientation: align the decal projector's +Z with the surface normal
      const lookTarget = pos.clone().add(n);
      const up = Math.abs(n.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const m = new THREE.Matrix4().lookAt(pos, lookTarget, up);
      const orientation = new THREE.Euler().setFromRotationMatrix(m);

      // Decal projector size — covers roughly one occlusal tooth surface
      const s = size;
      const decalSize = new THREE.Vector3(s, s, s * 1.2);
      return new DecalGeometry(mesh, pos, orientation, decalSize);
    } catch {
      return null;
    }
  }, [mesh, position, normal, size, kind, stage, treatment]);

  // Subtle pulse for active disease (pulp / abscess) — fades opacity
  useFrameImpl(({ clock }) => {
    if (!matRef.current) return;
    if (pulsing) {
      matRef.current.opacity = 0.85 + Math.sin(clock.elapsedTime * 2.4) * 0.15;
    } else {
      matRef.current.opacity = 1;
    }
  });

  if (!decalGeometry) return null;

  // Material props per category
  const isCaries  = kind === 'caries';
  const isMetal   = kind === 'metal_crown' || kind === 'amalgam';
  const isGlossy  = kind === 'metal_crown' || kind === 'all_ceramic_crown' || kind === 'pfm_crown';

  return (
    <mesh geometry={decalGeometry} renderOrder={2}>
      <meshStandardMaterial
        ref={matRef}
        map={texture}
        transparent
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        roughness={isCaries ? 0.95 : isGlossy ? 0.18 : isMetal ? 0.35 : 0.45}
        metalness={isMetal ? 0.85 : 0}
        side={THREE.FrontSide}
      />
    </mesh>
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

function PlaceholderArch({ simulation, activeStateIndex, clinicalPathology, pickedTooth }) {
  const groupRef = useRef();
  const activeState = simulation?.states?.[activeStateIndex];
  const targetTeeth = simulation?.target_teeth || [];

  const teeth = useMemo(() => generateTeethData(), []);
  const isPerioInflamed = activeState?.clinical_metrics?.pocket_depth_mm > 5;

  // Map clinical pathology kind → stage/treatment for ToothOverlay
  const pathologyState = useMemo(() => {
    if (!clinicalPathology?.kind) return null;
    const { kind, depth } = clinicalPathology;
    const stageMap = {
      incipient: 'enamel', enamel: 'enamel',
      dentin: 'dentin', deep_dentin: 'dentin', pulp_exposure: 'pulp',
    };
    const treatmentMap = {
      composite_filling: 'composite_filling',
      amalgam: 'composite_filling',
      inlay: 'composite_filling',
      all_ceramic_crown: 'zirconia_crown',
      pfm_crown: 'zirconia_crown',
      metal_crown: 'metal_crown',
      rct: 'root_canal',
    };
    const stage = kind === 'caries' ? (stageMap[depth] || 'enamel') :
                  kind === 'extraction' ? 'extracted' : 'restored';
    const treatment = treatmentMap[kind] || null;
    return {
      clinical_metrics: {
        stage,
        treatment,
        depth_mm: { incipient: 0.5, enamel: 1.5, dentin: 3, deep_dentin: 4.5, pulp_exposure: 6 }[depth] || 2,
        reversible: stage === 'enamel',
        risk: stage === 'pulp' || stage === 'abscess' ? 'high' : stage === 'dentin' ? 'moderate' : 'low',
      },
    };
  }, [clinicalPathology]);

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
        const isPickedClinical = tooth.fdi === pickedTooth && pathologyState;
        return (
          <group key={tooth.fdi} position={[tooth.x, tooth.y, tooth.z]} rotation={[0, tooth.angle, 0]}>
            {/* Clinical pathology overlay takes priority over simulation overlay */}
            {isPickedClinical ? (
              <ToothOverlay
                state={pathologyState}
                module={simulation?.module}
                targetTeeth={[pickedTooth]}
                toothNumber={tooth.fdi}
                toothSize={[tooth.width, tooth.height, tooth.depth]}
              />
            ) : isTarget && activeState ? (
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
                isPickedClinical ? 'bg-amber-400 text-black font-bold' :
                isTarget ? 'bg-white text-black font-bold' : 'text-gray-600'
              }`}>
                {tooth.fdi}
              </div>
            </Html>
          </group>
        );
      })}

      {/* Clinical pathology card — floats above the arch */}
      {clinicalPathology?.kind && pickedTooth && (
        <Html position={[0, 12, 0]} center>
          <PathologyCard pathology={clinicalPathology} tooth={pickedTooth} />
        </Html>
      )}

      {/* State label */}
      {activeState?.label && !clinicalPathology?.kind && (
        <Html position={[0, 10, 0]} center>
          <div className="bg-black/90 text-white px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap border border-white/10">
            {activeState.label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ── Clinical badge — always-visible overlay on the scan ──── */

function ClinicalBadge({ pathology, tooth, onReset }) {
  const { kind, depth, classification, surfaces } = pathology;

  const depthColors = {
    incipient: '#fbbf24', enamel: '#f59e0b',
    dentin: '#d97706', deep_dentin: '#b45309', pulp_exposure: '#ef4444',
  };
  const kindLabels = {
    caries: 'Caries (Cavity)', composite_filling: 'Composite Filling',
    amalgam: 'Amalgam Filling', inlay: 'Inlay/Onlay',
    all_ceramic_crown: 'All-Ceramic Crown', pfm_crown: 'PFM Crown',
    metal_crown: 'Full Metal Crown', rct: 'Root Canal Treatment',
    extraction: 'Extraction', sealant: 'Sealant', veneer: 'Veneer',
  };

  const isCaries = kind === 'caries';
  const isRestoration = !isCaries && kind !== 'extraction';
  const dotColor = isCaries ? (depthColors[depth] || '#f59e0b') : isRestoration ? '#4ade80' : '#f87171';
  const borderColor = dotColor + '55';

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      background: 'rgba(0,0,0,0.92)',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 10,
      padding: '10px 16px',
      minWidth: 260,
      boxShadow: `0 0 24px ${dotColor}33, 0 4px 20px rgba(0,0,0,0.6)`,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 11, height: 11, borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 10px ${dotColor}`,
          flexShrink: 0,
          animation: isCaries && depth === 'pulp_exposure' ? 'pulse 1s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
          Tooth #{tooth} — {kindLabels[kind] || kind}
        </span>
      </div>

      {/* Classification + Surfaces row */}
      {classification && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            Class {classification}
          </span>
          {surfaces?.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {surfaces.map(s => (
                <span key={s} style={{
                  fontSize: 11, fontWeight: 700, color: '#f59e0b',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 4, padding: '1px 6px',
                }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Depth bar */}
      {isCaries && depth && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#6b7280' }}>Depth / Extent</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: dotColor, textTransform: 'capitalize' }}>
              {depth.replace('_', ' ')}
            </span>
          </div>
          {/* Visual depth progress bar */}
          <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, #fbbf24, ${dotColor})`,
              width: { incipient: '12%', enamel: '30%', dentin: '55%', deep_dentin: '78%', pulp_exposure: '100%' }[depth] || '50%',
              transition: 'width 0.4s ease',
              boxShadow: `0 0 6px ${dotColor}`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            {['Incipient','Enamel','Dentin','Deep Dentin','Pulp'].map((l, i) => (
              <span key={i} style={{ fontSize: 8, color: '#4b5563' }}>{l}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pathology info card (React DOM, not Three.js) ────────── */

function PathologyCard({ pathology, tooth }) {
  const { kind, depth, classification, surfaces } = pathology;

  const depthColors = {
    incipient: '#fbbf24', enamel: '#f59e0b',
    dentin: '#d97706', deep_dentin: '#b45309', pulp_exposure: '#dc2626',
  };
  const kindLabels = {
    caries: 'Caries (Cavity)', composite_filling: 'Composite Filling',
    amalgam: 'Amalgam Filling', inlay: 'Inlay/Onlay',
    all_ceramic_crown: 'All-Ceramic Crown', pfm_crown: 'PFM Crown',
    metal_crown: 'Full Metal Crown', rct: 'Root Canal Treatment',
    extraction: 'Extraction', sealant: 'Sealant', veneer: 'Veneer',
  };
  const depthColor = depthColors[depth] || '#9ca3af';
  const isCaries = kind === 'caries';

  return (
    <div
      className="pointer-events-none select-none"
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: 'rgba(0,0,0,0.92)',
        border: `1px solid ${isCaries ? depthColor + '55' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 220,
        boxShadow: isCaries ? `0 0 18px ${depthColor}33` : '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: isCaries ? depthColor : '#4ade80',
          boxShadow: `0 0 8px ${isCaries ? depthColor : '#4ade80'}`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
          Tooth #{tooth}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#e5e7eb', marginBottom: 4 }}>
        {kindLabels[kind] || kind}
      </div>
      {classification && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
          Class {classification}{surfaces?.length ? ' · ' + surfaces.join('') : ''}
        </div>
      )}
      {isCaries && depth && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: depthColor }} />
          <span style={{ fontSize: 11, color: depthColor, fontWeight: 600, textTransform: 'capitalize' }}>
            {depth.replace('_', ' ')}
          </span>
        </div>
      )}
    </div>
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
