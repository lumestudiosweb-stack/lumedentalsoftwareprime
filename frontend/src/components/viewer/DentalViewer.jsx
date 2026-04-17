import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useThree, useLoader, useFrame as useFrameImpl } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Center, Line } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import ToothOverlay, { RealisticTooth } from './ToothOverlay';

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

function TreatmentJourney({ url, format, textureUrl, simulation, activeStateIndex, clinicalPathology, pickedTooth }) {
  const meshRef = useRef();
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

  const handleClickScan = (e) => {
    e.stopPropagation();
    if (e.face && e.point) {
      setMarkerPos([e.point.x, e.point.y, e.point.z]);
      const n = e.face.normal.clone().transformDirection(meshRef.current.matrixWorld).normalize();
      setMarkerNormal([n.x, n.y, n.z]);
    }
  };

  // ── Auto-place marker in the tooth zone when pathology is first set ──
  useEffect(() => {
    if (!clinicalPathology?.kind || !bbox) return;
    if (markerPos) return; // already placed — don't move it
    // Place in the upper-front portion of the scan (tooth zone)
    const x = 0;
    const y = bbox.topY * 0.72;
    const z = bbox.frontZ * 0.6;
    setMarkerPos([x, y, z]);
    setMarkerNormal([0, 1, 0.3]); // roughly upward + slightly toward camera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicalPathology?.kind]);

  // ── Reset marker when pathology is cleared ──
  useEffect(() => {
    if (!clinicalPathology?.kind) {
      setMarkerPos(null);
      setMarkerNormal(null);
    }
  }, [clinicalPathology?.kind]);

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
        ref={meshRef}
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

      {/* Click hint — only when no clinical pathology is set */}
      {!markerPos && !hasClinical && (
        <Html position={[0, bbox.topY + (texture ? 2.5 : 4), 0]} center distanceFactor={22}>
          <div className="text-white text-[11px] font-semibold px-3 py-1.5 rounded-md whitespace-nowrap pointer-events-none shadow-lg" style={{ background: '#3b82f6' }}>
            👆 Click any tooth on the scan to place the treatment
          </div>
        </Html>
      )}

      {/* Clinical pathology badge — top of scan, always visible when panel is filled */}
      {hasClinical && (
        <Html position={[0, bbox.topY + 3.5, 0]} center distanceFactor={22}>
          <ClinicalBadge pathology={clinicalPathology} tooth={pickedTooth} onReset={() => { setMarkerPos(null); setMarkerNormal(null); }} />
        </Html>
      )}

      {/* 3D treatment overlay — auto-placed or click-placed */}
      {markerPos && markerNormal && (
        <TreatmentOverlay
          position={markerPos}
          normal={markerNormal}
          size={overlaySize}
          stage={effectiveStage}
          treatment={effectiveTreatment}
          pulsing={isPulsing}
        />
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
   TreatmentOverlay — actual 3D anatomical treatment that appears on the
   tooth surface and morphs based on the current stage.

   Stages:
     • healthy     → nothing
     • enamel      → small brown demineralization spot
     • dentin      → bigger dark brown cavity (irregular shape)
     • pulp        → black hole reaching down with red glow inside
     • abscess     → dark hole + red inflamed aura
     • restored / composite_filling → smooth white composite dome
     • zirconia_crown / rct_crown   → shiny silver-white crown cap
     • root_canal  → rust-colored sealed cavity
─────────────────────────────────────────────────────────────────────── */
function TreatmentOverlay({ position, normal, size, stage, treatment, pulsing }) {
  const groupRef = useRef();
  const glowRef = useRef();

  // Orient the overlay so it sits FLAT against the tooth surface
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3(...normal).normalize();
    q.setFromUnitVectors(up, n);
    return q;
  }, [normal]);

  // Pulsing animation for active disease/treatment
  useFrameImpl(({ clock }) => {
    if (glowRef.current && pulsing) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.15;
      glowRef.current.scale.set(pulse, pulse, pulse);
      glowRef.current.material.opacity = 0.4 + Math.sin(clock.elapsedTime * 3) * 0.2;
    }
  });

  // Push the overlay slightly OUT from the surface so it doesn't z-fight
  const offset = useMemo(() => {
    const n = new THREE.Vector3(...normal).normalize().multiplyScalar(size * 0.05);
    return [position[0] + n.x, position[1] + n.y, position[2] + n.z];
  }, [position, normal, size]);

  return (
    <group ref={groupRef} position={offset} quaternion={quaternion}>
      {/* Render the visual based on stage/treatment */}
      <StageVisual stage={stage} treatment={treatment} size={size} />

      {/* Soft glow halo for active disease */}
      {(pulsing || ['pulp', 'abscess', 'dentin'].includes(stage)) && (
        <mesh ref={glowRef} position={[0, 0, 0]}>
          <sphereGeometry args={[size * 1.8, 24, 24]} />
          <meshBasicMaterial
            color={stage === 'abscess' ? '#ff2200' : stage === 'pulp' ? '#ff3333' : '#cc6622'}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/* Per-stage anatomical visual — sits in local coords with +Y as the surface normal */
function StageVisual({ stage, treatment, size }) {
  // Treatments win
  if (treatment === 'metal_crown') {
    // Full metal crown — silver/gold metallic dome
    return (
      <mesh position={[0, size * 0.4, 0]}>
        <sphereGeometry args={[size * 1.1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshPhysicalMaterial
          color="#c8ccd0"
          metalness={0.85}
          roughness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={0.95}
        />
      </mesh>
    );
  }
  if (treatment === 'zirconia_crown' || treatment === 'all_ceramic_crown' || treatment === 'rct_crown' || stage === 'restored') {
    // All-ceramic / zirconia crown — non-metallic, slight translucency, enamel-like
    return (
      <mesh position={[0, size * 0.4, 0]}>
        <sphereGeometry args={[size * 1.1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshPhysicalMaterial
          color="#f8f0e0"
          metalness={0.0}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.08}
          reflectivity={0.55}
          transmission={0.08}
          ior={1.5}
          thickness={0.3}
          attenuationColor="#f0e8d0"
          attenuationDistance={1.5}
        />
      </mesh>
    );
  }
  if (treatment === 'composite_filling') {
    // Smooth white composite filling — dome that fills the cavity
    return (
      <mesh position={[0, size * 0.1, 0]}>
        <sphereGeometry args={[size * 0.9, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshPhysicalMaterial
          color="#f5ecd0"
          metalness={0.05}
          roughness={0.3}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
        />
      </mesh>
    );
  }
  if (treatment === 'root_canal') {
    // Rust-colored sealed cavity (gutta-percha visible)
    return (
      <mesh position={[0, size * 0.05, 0]}>
        <sphereGeometry args={[size * 0.85, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#a86530" roughness={0.6} metalness={0.1} />
      </mesh>
    );
  }

  // Disease stages — progressive cavity
  switch (stage) {
    case 'enamel':
      // Small brown demineralization patch
      return (
        <mesh position={[0, size * 0.02, 0]}>
          <sphereGeometry args={[size * 0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.3]} />
          <meshStandardMaterial color="#8b6f3a" roughness={0.85} />
        </mesh>
      );
    case 'dentin':
      // Bigger dark brown cavity
      return (
        <group>
          <mesh position={[0, -size * 0.05, 0]}>
            <sphereGeometry args={[size * 0.85, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <meshStandardMaterial color="#3d2814" roughness={0.95} />
          </mesh>
          <mesh position={[0, -size * 0.02, 0]}>
            <sphereGeometry args={[size * 0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#1a0f08" roughness={1} />
          </mesh>
        </group>
      );
    case 'pulp':
      // Black hole going deep with red pulp visible inside
      return (
        <group>
          <mesh position={[0, -size * 0.15, 0]}>
            <sphereGeometry args={[size * 1.0, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#0a0503" roughness={1} />
          </mesh>
          <mesh position={[0, -size * 0.4, 0]}>
            <sphereGeometry args={[size * 0.4, 16, 12]} />
            <meshStandardMaterial color="#cc1111" emissive="#aa0000" emissiveIntensity={0.6} roughness={0.7} />
          </mesh>
        </group>
      );
    case 'abscess':
      // Severe — large dark hole + swollen red inflammation
      return (
        <group>
          <mesh position={[0, -size * 0.2, 0]}>
            <sphereGeometry args={[size * 1.2, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#000" roughness={1} />
          </mesh>
          <mesh position={[0, size * 0.1, 0]}>
            <sphereGeometry args={[size * 1.5, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
            <meshStandardMaterial color="#aa1a0a" emissive="#660000" emissiveIntensity={0.4} roughness={0.5} transparent opacity={0.7} />
          </mesh>
        </group>
      );
    case 'extracted':
      // Empty socket — dark concave depression
      return (
        <mesh position={[0, -size * 0.1, 0]} rotation={[Math.PI, 0, 0]}>
          <sphereGeometry args={[size * 0.9, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          <meshStandardMaterial color="#5a2020" roughness={0.9} />
        </mesh>
      );
    default:
      // Healthy — subtle ring marker so the user knows where they clicked
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, size * 0.02, 0]}>
          <ringGeometry args={[size * 0.5, size * 0.7, 32]} />
          <meshBasicMaterial color="#4ade80" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      );
  }
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
