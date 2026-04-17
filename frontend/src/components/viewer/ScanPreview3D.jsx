import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import { ImageIcon } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   Parse the raw binary PLY to extract attributes Three.js PLYLoader misses:
     • diffuse_red / diffuse_green / diffuse_blue  (scanner vertex colours)
     • texture_u  / texture_v  (scanner UV coords for texture atlas)
     • red / green / blue if they were somehow skipped
   Returns { colors: Float32Array|null, uvs: Float32Array|null }
───────────────────────────────────────────────────────────────────────── */
async function extractPLYExtras(url) {
  let buffer;
  try {
    const resp = await fetch(url);
    buffer = await resp.arrayBuffer();
  } catch { return { colors: null, uvs: null }; }

  const preview = new TextDecoder().decode(new Uint8Array(buffer, 0, 4096));
  const headerEnd = preview.indexOf('end_header');
  if (headerEnd === -1) return { colors: null, uvs: null };

  const headerText = preview.slice(0, headerEnd + 'end_header'.length);
  const lines = headerText.split(/\r?\n/);

  // Only works for binary_little_endian (the common scanner format)
  if (!headerText.includes('binary_little_endian')) return { colors: null, uvs: null };

  // Parse vertex element properties
  let vertexCount = 0;
  const props = [];
  let inVertex = false;
  const SIZES = { char:1,uchar:1,short:2,ushort:2,int:4,uint:4,float:4,double:8 };

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0]==='element' && parts[1]==='vertex') { vertexCount=parseInt(parts[2]); inVertex=true; continue; }
    if (parts[0]==='element' && parts[1]!=='vertex') { inVertex=false; continue; }
    if (inVertex && parts[0]==='property' && parts[1]!=='list') {
      props.push({ type: parts[1], name: parts[2] });
    }
  }
  if (!vertexCount || !props.length) return { colors: null, uvs: null };

  // Decide what we need
  const hasR     = props.some(p=>p.name==='red');
  const hasDR    = props.some(p=>p.name==='diffuse_red');
  const hasTexU  = props.some(p=>p.name==='texture_u'||p.name==='s');
  const hasTexV  = props.some(p=>p.name==='texture_v'||p.name==='t');
  const needsCol = hasDR || hasR;
  const needsUV  = hasTexU && hasTexV;
  if (!needsCol && !needsUV) return { colors: null, uvs: null };

  // Find binary data start
  const rawBytes = new Uint8Array(buffer);
  const enc = new TextEncoder();
  // Try \n and \r\n endings
  const markerNL = enc.encode('end_header\n');
  const markerCR = enc.encode('end_header\r\n');
  let dataOffset = -1;
  for (let i = 0; i < rawBytes.length - markerNL.length; i++) {
    let mNL=true, mCR=true;
    for (let j=0;j<markerNL.length;j++) if (rawBytes[i+j]!==markerNL[j]) { mNL=false; break; }
    if (mNL) { dataOffset=i+markerNL.length; break; }
    if (i < rawBytes.length-markerCR.length) {
      for (let j=0;j<markerCR.length;j++) if (rawBytes[i+j]!==markerCR[j]) { mCR=false; break; }
      if (mCR) { dataOffset=i+markerCR.length; break; }
    }
  }
  if (dataOffset===-1) return { colors: null, uvs: null };

  // Compute stride + per-property byte offsets
  let stride=0;
  const off={};
  for (const p of props) { off[p.name]=stride; stride+=(SIZES[p.type]||4); }

  const view = new DataView(buffer, dataOffset);
  const colors = needsCol ? new Float32Array(vertexCount*3) : null;
  const uvs    = needsUV  ? new Float32Array(vertexCount*2) : null;

  const rName = hasDR?'diffuse_red':'red';
  const gName = hasDR?'diffuse_green':'green';
  const bName = hasDR?'diffuse_blue':'blue';
  const uName = props.find(p=>p.name==='texture_u')?.name || 's';
  const vName = props.find(p=>p.name==='texture_v')?.name || 't';

  for (let i=0; i<vertexCount; i++) {
    const base = i*stride;
    if (colors) {
      colors[i*3]   = view.getUint8(base+off[rName])/255;
      colors[i*3+1] = view.getUint8(base+off[gName])/255;
      colors[i*3+2] = view.getUint8(base+off[bName])/255;
    }
    if (uvs) {
      uvs[i*2]   = view.getFloat32(base+off[uName], true);
      uvs[i*2+1] = view.getFloat32(base+off[vName], true);
    }
  }

  return { colors, uvs };
}

/* ─────────────────────────────────────────────────────────────────────────
   Fix uint8 vertex colours stored without normalisation (range 0-255 instead of 0-1)
───────────────────────────────────────────────────────────────────────── */
function normalizeVertexColors(geo) {
  const col = geo.attributes.color;
  if (!col) return false;
  let max = 0;
  for (let i=0;i<Math.min(col.count,128);i++) {
    max = Math.max(max, col.getX(i), col.getY(i), col.getZ(i));
  }
  if (max > 1.5) {
    const arr = col.array;
    for (let i=0;i<arr.length;i++) arr[i]/=255;
    col.needsUpdate = true;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────
   Main mesh component
───────────────────────────────────────────────────────────────────────── */
function ScanMesh({ url, format, textureUrl }) {
  const groupRef = useRef();
  const [geo,   setGeo]   = useState(null);
  const [scene, setScene] = useState(null);
  const [mat,   setMat]   = useState(null);
  const [hasVC, setHasVC] = useState(false);
  const [hasUV, setHasUV] = useState(false);
  const [ready, setReady] = useState(false);

  /* ── Load geometry ── */
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setReady(false); setGeo(null); setScene(null); setMat(null);

    const fmt = (format||'').toLowerCase();

    const finishGeo = (g, extras) => {
      if (cancelled) return;
      if (!g.attributes.normal?.count) g.computeVertexNormals();

      // Inject extras from our custom parser
      if (extras?.colors && !(g.attributes.color?.count>0)) {
        g.setAttribute('color', new THREE.BufferAttribute(extras.colors, 3));
      }
      if (extras?.uvs && !(g.attributes.uv?.count>0)) {
        g.setAttribute('uv', new THREE.BufferAttribute(extras.uvs, 2));
      }

      const vc = normalizeVertexColors(g);
      const uv = !!(g.attributes.uv?.count>0);

      g.computeBoundingBox();
      const c=new THREE.Vector3(); g.boundingBox.getCenter(c);
      g.translate(-c.x,-c.y,-c.z);

      setHasVC(vc); setHasUV(uv);
      setGeo(g); setReady(true);
    };

    if (fmt==='stl') {
      new STLLoader().load(url, (g)=>finishGeo(g, null));
    } else if (fmt==='ply') {
      extractPLYExtras(url).then(extras => {
        if (cancelled) return;
        new PLYLoader().load(url, (g)=>finishGeo(g, extras));
      }).catch(()=>{ if (!cancelled) new PLYLoader().load(url, (g)=>finishGeo(g,null)); });
    } else if (fmt==='obj') {
      new OBJLoader().load(url, (obj)=>{
        if (cancelled) return;
        const bb=new THREE.Box3().setFromObject(obj);
        const c=new THREE.Vector3(); bb.getCenter(c);
        obj.position.sub(c);
        setScene(obj); setReady(true);
      });
    }
    return ()=>{ cancelled=true; };
  }, [url, format]);

  /* ── Material — rebuild when texture or VC state changes ── */
  useEffect(() => {
    if (!ready) return;

    if (textureUrl) {
      new THREE.TextureLoader().load(textureUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        // Atlas textures from scanners are typically NOT flipped
        tex.flipY = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        setMat(new THREE.MeshStandardMaterial({
          map: tex,
          vertexColors: false,
          roughness: 0.38,
          metalness: 0.04,
          side: THREE.DoubleSide,
        }));
      });
    } else {
      setMat(new THREE.MeshStandardMaterial({
        vertexColors: hasVC,
        color: hasVC ? undefined : '#d8cfbf',
        roughness: 0.5,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }));
    }
  }, [ready, hasVC, textureUrl]);

  /* ── Apply material to OBJ children ── */
  useEffect(()=>{
    if (!scene||!mat) return;
    scene.traverse(c=>{ if(c.isMesh) c.material=mat; });
  },[scene,mat]);

  /* ── Gentle rotation ── */
  useFrame((_,dt)=>{ if(groupRef.current) groupRef.current.rotation.y+=dt*0.15; });

  if (!ready||!mat) return null;

  const sz=(bb)=>Math.max(bb.max.x-bb.min.x,bb.max.y-bb.min.y,bb.max.z-bb.min.z);
  let scale=1;
  if(geo){ geo.computeBoundingBox(); scale=20/(sz(geo.boundingBox)||1); }
  else if(scene){ const bb=new THREE.Box3().setFromObject(scene); scale=20/(sz(bb)||1); }

  return (
    <group ref={groupRef} scale={[scale,scale,scale]}>
      {geo   && <mesh geometry={geo} material={mat} />}
      {scene && <primitive object={scene} />}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Public component
───────────────────────────────────────────────────────────────────────── */
export default function ScanPreview3D({ scanUrl, scanFormat, className='' }) {
  const [textureUrl,  setTextureUrl]  = useState(null);
  const [textureName, setTextureName] = useState(null);
  const [dragOver,    setDragOver]    = useState(false);
  const colorInputRef = useRef(null);

  const applyColorFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg','jpeg','png','webp'].includes(ext)) return;
    setTextureName(file.name);
    setTextureUrl(URL.createObjectURL(file));
  }, []);

  const handleColorUpload = useCallback((e) => applyColorFile(e.target.files?.[0]), [applyColorFile]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    applyColorFile(file);
  }, [applyColorFile]);

  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  if (!scanUrl) return null;

  return (
    <div
      className={`relative flex flex-col ${className}`}
      style={{minHeight:0}}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/50 border-b border-white/5 shrink-0">
        <input ref={colorInputRef} type="file" accept=".jpg,.jpeg,.png,.webp"
          className="hidden" onChange={handleColorUpload} />
        <button onClick={()=>colorInputRef.current?.click()}
          className={`flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg border transition ${
            textureUrl
              ? 'border-green-500/30 text-green-400 bg-green-500/5'
              : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
          }`}>
          <ImageIcon size={12} />
          {textureName ? `✓ ${textureName}` : 'Add Colour (click or drop JPEG here)'}
        </button>
        {textureUrl && (
          <button onClick={()=>{setTextureUrl(null);setTextureName(null);}}
            className="text-[11px] text-gray-600 hover:text-red-400 transition">
            Remove
          </button>
        )}
        <span className="ml-auto text-[10px] text-gray-600 italic">
          {textureUrl ? 'Texture atlas applied' : 'Drop the colour JPEG anywhere on the viewer'}
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1" style={{minHeight:0}}>
        <Canvas camera={{position:[0,6,28],fov:42}}
          gl={{antialias:true,alpha:false}}
          style={{width:'100%',height:'100%'}}>
          <color attach="background" args={['#0c0c0c']} />
          <ambientLight intensity={1.0} />
          <directionalLight position={[10,20,8]}  intensity={1.8} />
          <directionalLight position={[-8,4,-10]} intensity={0.7} color="#ffd8b0" />
          <pointLight       position={[0,-14,0]}  intensity={0.3} color="#ffaaaa" />

          <Suspense fallback={null}>
            <ScanMesh url={scanUrl} format={scanFormat} textureUrl={textureUrl} />
            <OrbitControls enablePan={false} minDistance={8} maxDistance={65}
              enableDamping dampingFactor={0.08} />
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 border-2 border-dashed border-lume-400 rounded-xl pointer-events-none">
          <ImageIcon size={32} className="text-lume-400 mb-3" />
          <p className="text-white font-semibold text-sm">Drop colour JPEG to apply</p>
          <p className="text-gray-400 text-xs mt-1">Texture atlas from your scanner</p>
        </div>
      )}

      <div className="absolute bottom-2 left-3 text-[9px] text-gray-700 pointer-events-none">
        Drag · Rotate &nbsp;|&nbsp; Scroll · Zoom
      </div>
    </div>
  );
}
