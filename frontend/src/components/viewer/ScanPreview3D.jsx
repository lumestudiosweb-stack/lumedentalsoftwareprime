import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';
import { ImageIcon, Loader2 } from 'lucide-react';

/* ── Mesh component ─────────────────────────────────────────────────────── */
function ScanMesh({ url, format, textureUrl }) {
  const groupRef  = useRef();
  const meshRef   = useRef();
  const [scene, setScene] = useState(null);   // for OBJ (Group)
  const [geo,   setGeo]   = useState(null);   // for STL/PLY (BufferGeometry)
  const [mat,   setMat]   = useState(null);
  const [ready, setReady] = useState(false);

  /* ── Load geometry ── */
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setReady(false);
    setGeo(null);
    setScene(null);

    const fmt = (format || '').toLowerCase();

    const prepareGeo = (g) => {
      if (cancelled) return;
      if (!g.attributes.normal || g.attributes.normal.count === 0)
        g.computeVertexNormals();
      g.computeBoundingBox();
      // Center
      const c = new THREE.Vector3();
      g.boundingBox.getCenter(c);
      g.translate(-c.x, -c.y, -c.z);
      setGeo(g);
      setReady(true);
    };

    if (fmt === 'stl') {
      new STLLoader().load(url, prepareGeo);
    } else if (fmt === 'ply') {
      new PLYLoader().load(url, prepareGeo);
    } else if (fmt === 'obj') {
      new OBJLoader().load(url, (obj) => {
        if (cancelled) return;
        // Center the group
        const box = new THREE.Box3().setFromObject(obj);
        const c = new THREE.Vector3();
        box.getCenter(c);
        obj.position.sub(c);
        setScene(obj);
        setReady(true);
      });
    }

    return () => { cancelled = true; };
  }, [url, format]);

  /* ── Build / update material whenever texture changes ── */
  useEffect(() => {
    const hasNativeColors = geo?.attributes?.color?.count > 0;

    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(textureUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        setMat(new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.45,
          metalness: 0.04,
          side: THREE.DoubleSide,
        }));
      });
    } else {
      setMat(new THREE.MeshStandardMaterial({
        vertexColors: hasNativeColors,
        // Neutral off-white when no color source
        color: hasNativeColors ? undefined : '#e8dfd0',
        roughness: 0.55,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }));
    }
  }, [geo, textureUrl]);

  /* ── Apply material to OBJ children ── */
  useEffect(() => {
    if (!scene || !mat) return;
    scene.traverse((child) => {
      if (child.isMesh) child.material = mat;
    });
  }, [scene, mat]);

  /* ── Gentle auto-rotate ── */
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.18;
  });

  if (!ready || !mat) return null;

  // Compute scale to fill ~20 units
  let scaleVal = 1;
  if (geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const size = Math.max(bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z);
    scaleVal = 20 / (size || 1);
  } else if (scene) {
    const bb = new THREE.Box3().setFromObject(scene);
    const size = Math.max(
      bb.max.x-bb.min.x,
      bb.max.y-bb.min.y,
      bb.max.z-bb.min.z
    );
    scaleVal = 20 / (size || 1);
  }

  return (
    <group ref={groupRef} scale={[scaleVal, scaleVal, scaleVal]}>
      {geo && (
        <mesh ref={meshRef} geometry={geo} material={mat} />
      )}
      {scene && (
        <primitive ref={meshRef} object={scene} />
      )}
    </group>
  );
}

/* ── Public component ────────────────────────────────────────────────────── */
export default function ScanPreview3D({ scanUrl, scanFormat, className = '' }) {
  const [textureUrl, setTextureUrl]   = useState(null);
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
    <div className={`relative flex flex-col ${className}`}>
      {/* Colour file toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/40 border-b border-white/5">
        <input
          ref={colorInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleColorUpload}
        />
        <button
          onClick={() => colorInputRef.current?.click()}
          className={`flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg border transition ${
            textureUrl
              ? 'border-green-500/30 text-green-400 bg-green-500/5'
              : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ImageIcon size={12} />
          {textureName ? `Color: ${textureName}` : 'Upload Color File (JPEG / PNG)'}
        </button>
        {textureUrl && (
          <button
            onClick={() => { setTextureUrl(null); setTextureName(null); }}
            className="text-[11px] text-gray-600 hover:text-red-400 transition"
          >
            Remove color
          </button>
        )}
        <span className="ml-auto text-[10px] text-gray-700">
          {textureUrl ? 'Texture applied' : 'No color — upload JPEG from scanner'}
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <Canvas
          camera={{ position: [0, 8, 28], fov: 42 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#0d0d0d']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 20, 10]} intensity={2.0} castShadow />
          <directionalLight position={[-8, 5, -10]} intensity={0.9} color="#ffe0c0" />
          <pointLight position={[0, -15, 0]} intensity={0.4} color="#ffaaaa" />

          <Suspense fallback={null}>
            <ScanMesh url={scanUrl} format={scanFormat} textureUrl={textureUrl} />
            <OrbitControls
              enablePan={false}
              minDistance={8}
              maxDistance={60}
              enableDamping
              dampingFactor={0.08}
            />
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      {/* Corner label */}
      <div className="absolute bottom-3 left-3 text-[10px] text-gray-600 pointer-events-none">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
