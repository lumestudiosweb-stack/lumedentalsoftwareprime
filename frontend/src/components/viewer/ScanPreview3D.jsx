import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import { ImageIcon } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   Parse PLY header and manually extract diffuse_red/green/blue colours.
   Three.js PLYLoader only reads "red/green/blue" — many scanners write
   "diffuse_red/green/blue" which is silently ignored.
───────────────────────────────────────────────────────────────────────── */
async function loadPLYWithColors(url) {
  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  const text = new TextDecoder().decode(new Uint8Array(buffer, 0, 2048));

  // Parse header
  const headerEnd = text.indexOf('end_header');
  if (headerEnd === -1) return null; // not a PLY
  const headerText = text.slice(0, headerEnd + 'end_header'.length + 1);
  const headerLines = headerText.split(/\r?\n/);

  // Find vertex count and property list
  let vertexCount = 0;
  const props = []; // { name, type }
  let inVertex = false;
  const TYPE_SIZES = { char:1, uchar:1, short:2, ushort:2, int:4, uint:4, float:4, double:8 };

  for (const line of headerLines) {
    if (line.startsWith('element vertex')) vertexCount = parseInt(line.split(' ')[2]);
    if (line.startsWith('element') && !line.startsWith('element vertex')) inVertex = false;
    if (line.startsWith('element vertex')) inVertex = true;
    if (inVertex && line.startsWith('property') && !line.startsWith('property list')) {
      const parts = line.trim().split(/\s+/);
      props.push({ type: parts[1], name: parts[2] });
    }
  }

  if (!vertexCount) return null;

  // Look for diffuse colour props
  const hasDiffuse = props.some((p) => p.name === 'diffuse_red');
  const hasRGB     = props.some((p) => p.name === 'red');
  if (!hasDiffuse && !hasRGB) return null; // let PLYLoader handle it normally

  // Binary format? Check header
  const isBinary = headerText.includes('binary_little_endian') || headerText.includes('binary_big_endian');
  const isLittleEndian = headerText.includes('binary_little_endian');

  if (!isBinary) return null; // ASCII — PLYLoader handles it fine

  // Find byte offset of vertex data (right after "end_header\n")
  const rawBytes = new Uint8Array(buffer);
  const enc = new TextEncoder();
  const marker = enc.encode('end_header\n');
  let dataOffset = -1;
  for (let i = 0; i < rawBytes.length - marker.length; i++) {
    let match = true;
    for (let j = 0; j < marker.length; j++) {
      if (rawBytes[i + j] !== marker[j]) { match = false; break; }
    }
    if (match) { dataOffset = i + marker.length; break; }
  }
  if (dataOffset === -1) return null;

  // Compute stride and byte offsets for each property
  let stride = 0;
  const offsets = {};
  for (const p of props) {
    offsets[p.name] = stride;
    stride += TYPE_SIZES[p.type] || 4;
  }

  const view = new DataView(buffer, dataOffset);
  const colors = new Float32Array(vertexCount * 3);

  const rProp = hasDiffuse ? 'diffuse_red'   : 'red';
  const gProp = hasDiffuse ? 'diffuse_green' : 'green';
  const bProp = hasDiffuse ? 'diffuse_blue'  : 'blue';

  for (let i = 0; i < vertexCount; i++) {
    const base = i * stride;
    const r = view.getUint8(base + offsets[rProp]);
    const g = view.getUint8(base + offsets[gProp]);
    const b = view.getUint8(base + offsets[bProp]);
    colors[i * 3]     = r / 255;
    colors[i * 3 + 1] = g / 255;
    colors[i * 3 + 2] = b / 255;
  }

  return colors; // Float32Array length = vertexCount * 3
}

/* ─────────────────────────────────────────────────────────────────────────
   Cylindrical UV projection — reasonable approximation for a dental arch
   so a JPEG texture can be draped over STL/PLY geometry.
───────────────────────────────────────────────────────────────────────── */
function computeCylindricalUVs(geo) {
  geo.computeBoundingBox();
  const bb  = geo.boundingBox;
  const cx  = (bb.max.x + bb.min.x) / 2;
  const cz  = (bb.max.z + bb.min.z) / 2;
  const minY = bb.min.y, maxY = bb.max.y;

  const positions = geo.attributes.position;
  const count = positions.count;
  const uvs = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const x = positions.getX(i) - cx;
    const y = positions.getY(i);
    const z = positions.getZ(i) - cz;
    const theta = Math.atan2(z, x); // -PI to PI
    uvs[i * 2]     = (theta + Math.PI) / (2 * Math.PI);
    uvs[i * 2 + 1] = (y - minY) / ((maxY - minY) || 1);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

/* ─────────────────────────────────────────────────────────────────────────
   Fix vertex colors that may be in 0-255 range instead of 0-1
───────────────────────────────────────────────────────────────────────── */
function normalizeVertexColors(geo) {
  const col = geo.attributes.color;
  if (!col) return false;
  // Sample a few values — if any > 1.5, they're uint8 and need dividing
  let needsNorm = false;
  for (let i = 0; i < Math.min(col.count, 64); i++) {
    if (col.getX(i) > 1.5 || col.getY(i) > 1.5 || col.getZ(i) > 1.5) {
      needsNorm = true; break;
    }
  }
  if (!needsNorm) return true;
  const arr = col.array;
  for (let i = 0; i < arr.length; i++) arr[i] /= 255;
  col.needsUpdate = true;
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────
   Main mesh component
───────────────────────────────────────────────────────────────────────── */
function ScanMesh({ url, format, textureUrl }) {
  const groupRef = useRef();
  const [scene,  setScene]  = useState(null);
  const [geo,    setGeo]    = useState(null);
  const [mat,    setMat]    = useState(null);
  const [hasVC,  setHasVC]  = useState(false);
  const [ready,  setReady]  = useState(false);

  /* ── Load geometry ── */
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setReady(false); setGeo(null); setScene(null); setMat(null); setHasVC(false);

    const fmt = (format || '').toLowerCase();

    const finishGeo = (g) => {
      if (cancelled) return;
      if (!g.attributes.normal || !g.attributes.normal.count)
        g.computeVertexNormals();
      g.computeBoundingBox();
      const c = new THREE.Vector3();
      g.boundingBox.getCenter(c);
      g.translate(-c.x, -c.y, -c.z);

      const hasColors = normalizeVertexColors(g);
      setHasVC(hasColors);
      setGeo(g);
      setReady(true);
    };

    if (fmt === 'stl') {
      new STLLoader().load(url, finishGeo);
    } else if (fmt === 'ply') {
      // First try to extract diffuse colours manually, THEN load with PLYLoader
      loadPLYWithColors(url).then((diffuseColors) => {
        if (cancelled) return;
        new PLYLoader().load(url, (g) => {
          if (cancelled) return;
          // Inject diffuse colours if PLYLoader didn't find any
          if (diffuseColors && !(g.attributes.color?.count > 0)) {
            g.setAttribute('color', new THREE.BufferAttribute(diffuseColors, 3));
          }
          finishGeo(g);
        });
      }).catch(() => {
        if (cancelled) return;
        new PLYLoader().load(url, finishGeo);
      });
    } else if (fmt === 'obj') {
      new OBJLoader().load(url, (obj) => {
        if (cancelled) return;
        const bb = new THREE.Box3().setFromObject(obj);
        const c = new THREE.Vector3(); bb.getCenter(c);
        obj.position.sub(c);
        setScene(obj);
        setReady(true);
      });
    }

    return () => { cancelled = true; };
  }, [url, format]);

  /* ── Build/update material when texture or geometry changes ── */
  useEffect(() => {
    if (!ready) return;
    const fmt = (format || '').toLowerCase();

    if (textureUrl) {
      // Ensure PLY/STL have UVs before applying texture
      if (geo && !geo.attributes.uv) {
        computeCylindricalUVs(geo);
      }
      new THREE.TextureLoader().load(textureUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = fmt === 'obj' ? true : false;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        setMat(new THREE.MeshStandardMaterial({
          map: tex,
          vertexColors: false,
          roughness: 0.4,
          metalness: 0.03,
          side: THREE.DoubleSide,
        }));
      });
    } else {
      setMat(new THREE.MeshStandardMaterial({
        vertexColors: hasVC,
        color: hasVC ? undefined : '#ddd5c0',
        roughness: 0.5,
        metalness: 0.03,
        side: THREE.DoubleSide,
      }));
    }
  }, [ready, geo, hasVC, textureUrl, format]);

  /* ── Apply material to OBJ children ── */
  useEffect(() => {
    if (!scene || !mat) return;
    scene.traverse((c) => { if (c.isMesh) c.material = mat; });
  }, [scene, mat]);

  /* ── Gentle rotation ── */
  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.16;
  });

  if (!ready || !mat) return null;

  let scaleVal = 1;
  const getSize = (bb) => Math.max(bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z);
  if (geo) {
    geo.computeBoundingBox();
    scaleVal = 20 / (getSize(geo.boundingBox) || 1);
  } else if (scene) {
    const bb = new THREE.Box3().setFromObject(scene);
    scaleVal = 20 / (getSize(bb) || 1);
  }

  return (
    <group ref={groupRef} scale={[scaleVal, scaleVal, scaleVal]}>
      {geo   && <mesh geometry={geo} material={mat} />}
      {scene && <primitive object={scene} />}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Public component — self-contained with colour upload toolbar
───────────────────────────────────────────────────────────────────────── */
export default function ScanPreview3D({ scanUrl, scanFormat, className = '' }) {
  const [textureUrl,  setTextureUrl]  = useState(null);
  const [textureName, setTextureName] = useState(null);
  const colorInputRef = useRef(null);

  const handleColorUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg','jpeg','png','webp'].includes(ext)) return;
    setTextureName(file.name);
    setTextureUrl(URL.createObjectURL(file));
  }, []);

  if (!scanUrl) return null;

  return (
    <div className={`relative flex flex-col ${className}`} style={{ minHeight: 0 }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/50 border-b border-white/5 shrink-0">
        <input ref={colorInputRef} type="file" accept=".jpg,.jpeg,.png,.webp"
          className="hidden" onChange={handleColorUpload} />
        <button
          onClick={() => colorInputRef.current?.click()}
          className={`flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg border transition ${
            textureUrl
              ? 'border-green-500/30 text-green-400 bg-green-500/5'
              : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ImageIcon size={12} />
          {textureName ? `✓ ${textureName}` : 'Upload Color File (JPEG / PNG)'}
        </button>
        {textureUrl && (
          <button onClick={() => { setTextureUrl(null); setTextureName(null); }}
            className="text-[11px] text-gray-600 hover:text-red-400 transition">
            Remove
          </button>
        )}
        <span className="ml-auto text-[10px] text-gray-600 italic">
          {textureUrl
            ? 'Texture applied — drag to inspect'
            : 'If scan has no colour, upload the JPEG from your scanner folder'}
        </span>
      </div>

      {/* ── 3D Canvas ── */}
      <div className="flex-1" style={{ minHeight: 0 }}>
        <Canvas
          camera={{ position: [0, 6, 28], fov: 42 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#0c0c0c']} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[10, 20, 8]}  intensity={2.0} />
          <directionalLight position={[-8, 4, -10]} intensity={0.8} color="#ffd8b0" />
          <pointLight       position={[0, -14, 0]}  intensity={0.3} color="#ffaaaa" />

          <Suspense fallback={null}>
            <ScanMesh url={scanUrl} format={scanFormat} textureUrl={textureUrl} />
            <OrbitControls enablePan={false} minDistance={8} maxDistance={65}
              enableDamping dampingFactor={0.08} />
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute bottom-2 left-3 text-[9px] text-gray-700 pointer-events-none">
        Drag · Rotate &nbsp;|&nbsp; Scroll · Zoom
      </div>
    </div>
  );
}
