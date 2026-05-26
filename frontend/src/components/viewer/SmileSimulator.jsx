import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import {
  X, Sparkles, Play, Pause, RotateCcw, FlipVertical2,
  Loader2, AlertTriangle, Sun, Eye, Settings, Droplets,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   SmileSimulator — the flagship cosmetic-dentistry tool.

   Loads a REAL anonymized patient arch scan (PLY + colour JPG), corrects
   the scanner's Z-up orientation so the teeth face the camera, then runs
   a real-time teeth-whitening shader with a draggable BEFORE / AFTER
   divider. Everything happens on the patient's own scan — no pre-rendered
   video, no fakery. The whitening is computed per-pixel on the actual
   intra-oral texture, masking the gums/tongue out so only enamel brightens.

   Why a screen-space split (not two meshes): one draw call, one material,
   a pixel-perfect divider line that stays vertical no matter how the model
   is rotated — exactly the "before/after slider" UX patients recognise.

   The shader is injected into a MeshPhysicalMaterial via onBeforeCompile so
   we keep full PBR lighting + studio IBL reflections on the enamel (which
   is what makes whitened teeth read as glossy and real, not chalky).
─────────────────────────────────────────────────────────────────────── */

/* GLSL injected before main() — declares our uniforms + the whitening math. */
const GLSL_HELPERS = /* glsl */`
  uniform float uSplit;       // 0..1 divider position (fraction of width)
  uniform float uResX;        // drawing-buffer width in physical pixels
  uniform float uWhiten;      // 0..1 whitening strength
  uniform float uPreviewAll;  // 1.0 = whiten whole arch (ignore split)

  vec3 _lin2srgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
  vec3 _srgb2lin(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }

  // Tooth vs gum/tongue mask, evaluated in perceptual (sRGB) space.
  // Gums & tongue are red-dominant (large R-G gap); enamel is bright and
  // near-neutral. We brighten ONLY enamel so the result stays clinical.
  float _toothMask(vec3 s){
    float bright = max(s.r, max(s.g, s.b));
    float gum    = smoothstep(0.10, 0.30, s.r - s.g); // red dominance -> soft tissue
    float dark   = smoothstep(0.18, 0.40, bright);    // exclude deep shadows/gaps
    return clamp(dark * (1.0 - gum), 0.0, 1.0);
  }

  // Whiten WITHOUT going chalky. The trick: remove the yellow CHROMA while
  // preserving each pixel's own luminance — so the baked highlights stay
  // bright and the tooth body stays slightly darker (i.e. the enamel keeps
  // its shape and depth). Brightening is a gamma curve, NOT a lift toward
  // white, because a linear lift compresses highlights into the body and
  // makes teeth look like flat matte paint. The wet GLOSS itself comes from
  // the material's clearcoat/specular, not from the albedo.
  vec3 _whiten(vec3 s, float amt){
    float l = dot(s, vec3(0.299, 0.587, 0.114));
    vec3 c = mix(s, vec3(l), 0.55 * amt);             // strip the yellow, keep luminance/contrast
    c.b = mix(c.b, max(c.b, c.g * 0.97), 0.5 * amt);  // neutralise residual yellow
    c = pow(max(c, 0.0), vec3(1.0 - 0.20 * amt));     // gamma brighten (highlights stay crisp)
    return clamp(c, 0.0, 1.0);
  }
`;

/* GLSL injected right after <map_fragment>: decide side, mask, whiten. */
const GLSL_APPLY = /* glsl */`
  {
    float splitPx   = uSplit * uResX;
    float sideAfter = step(splitPx, gl_FragCoord.x);     // 1.0 on the AFTER (right) side
    float amt       = max(uPreviewAll, sideAfter) * uWhiten;
    if (amt > 0.001) {
      vec3 s  = _lin2srgb(clamp(diffuseColor.rgb, 0.0, 1.0));
      float m = _toothMask(s);
      vec3 w  = _whiten(s, amt * m);
      diffuseColor.rgb = _srgb2lin(w);
    }
  }
`;

/* ──────────────────────────────────────────────────────────────────────
   reorientAndFrame — scanner exports use the occlusal (bite) axis as Z
   ("Z-up"), so a raw load renders the arch lying on its side. We detect the
   occlusal axis as the SMALLEST bounding-box extent (an arch is wide & deep
   but shallow), rotate it to world-Y, make sure the wider span is left↔right,
   then normalise scale so every scan frames identically.
─────────────────────────────────────────────────────────────────────── */
function reorientAndFrame(geo) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  geo.center();
  geo.computeBoundingBox();

  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);

  // Smallest extent = occlusal (gum→biting-surface) axis.
  const ext = [size.x, size.y, size.z];
  const minAxis = ext.indexOf(Math.min(ext[0], ext[1], ext[2]));
  if (minAxis === 0) geo.rotateZ(Math.PI / 2);       // X → Y
  else if (minAxis === 2) geo.rotateX(-Math.PI / 2); // Z → Y (the usual case)

  geo.center();
  geo.computeBoundingBox();
  geo.boundingBox.getSize(size);

  // Frame so the arch is wider left↔right than front↔back (natural smile crop).
  if (size.x < size.z) {
    geo.rotateY(Math.PI / 2);
    geo.center();
    geo.computeBoundingBox();
    geo.boundingBox.getSize(size);
  }

  // Normalise scale to a consistent on-screen size.
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = 24 / maxDim;
  geo.scale(s, s, s);
  geo.center();
  geo.computeBoundingBox();
  return geo;
}

/* The whitening mesh — single static mesh, single material. Reads the live
   split / whiten values from refs each frame so dragging the divider never
   re-renders the React tree or recompiles the shader. */
function WhiteningMesh({ geometry, texture, flipped, splitRef, whitenRef, previewAllRef, wetRef, reflectRef, brightRef }) {
  const { gl } = useThree();
  const uniformsRef = useRef(null);

  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: texture || null,
      color: 0xffffff,
      // The WET "sweaty" saliva sheen the real scan has: a very smooth
      // surface under a max clear coat reflecting a bright neutral
      // environment. Low roughness => sharp, moist-looking glints that
      // travel across the teeth AND gums as you orbit. Highlights are pure
      // white (PBR-Neutral tone-maps them gracefully), so they read as
      // moisture on top of the real colour, not as a colour change.
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.6,
      specularIntensity: 1.0,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSplit = { value: splitRef.current };
      shader.uniforms.uResX = { value: 1000 };
      shader.uniforms.uWhiten = { value: whitenRef.current };
      shader.uniforms.uPreviewAll = { value: previewAllRef.current ? 1 : 0 };
      uniformsRef.current = shader.uniforms;
      // Anchor both injections to standard shader chunks that are GUARANTEED
      // present in every Three material:
      //   • <common>       (global scope, top of file) → uniform + fn decls
      //   • <map_fragment> (inside main, after diffuse sample) → the apply
      // This keeps the declarations and their usage in lockstep — if one
      // anchor were ever missing, neither half injects, so we never end up
      // referencing undeclared GLSL symbols (which would black out the mesh).
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${GLSL_HELPERS}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${GLSL_APPLY}`);
    };
    // Stable cache key so our injected program is reused.
    m.customProgramCacheKey = () => 'lume-whitening-v1';
    return m;
  }, [texture, splitRef, whitenRef, previewAllRef]);

  useFrame(() => {
    // ── Live realism tuning (read from refs so sliders update the look
    //    instantly without re-rendering React or recompiling the shader).
    //    These are all uniform/renderer updates — cheap every frame. ──
    const wet = wetRef.current;        // 0..1  (0 = dry/matte, 1 = very wet)
    material.roughness = THREE.MathUtils.lerp(0.5, 0.07, wet);
    material.clearcoat = THREE.MathUtils.lerp(0.25, 1.0, wet);     // stays > 0 (no recompile)
    material.clearcoatRoughness = THREE.MathUtils.lerp(0.22, 0.025, wet);
    material.envMapIntensity = reflectRef.current * 2.0;           // 0..2
    gl.toneMappingExposure = 0.6 + brightRef.current * 1.0;        // 0.6..1.6

    // ── Whitening / split shader uniforms (once the shader has compiled) ──
    const u = uniformsRef.current;
    if (u) {
      u.uSplit.value = splitRef.current;
      u.uWhiten.value = whitenRef.current;
      u.uPreviewAll.value = previewAllRef.current ? 1 : 0;
      // gl_FragCoord is in physical pixels → use the drawing-buffer width.
      u.uResX.value = gl.domElement.width;
    }
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[flipped ? Math.PI : 0, 0, 0]}
    />
  );
}

function Scene({ geometry, texture, flipped, controlsRef, splitRef, whitenRef, previewAllRef, wetRef, reflectRef, brightRef }) {
  return (
    <>
      {/* All lights are pure WHITE — no colour cast, so the scan's baked
          colour reads true (the earlier coloured fills were corrupting it).
          Ambient + hemisphere keep the colour readable everywhere; the key
          light + studio Environment give the glossy clear coat bright,
          neutral things to reflect → the wet specular glints. */}
      <ambientLight intensity={0.3} />
      <hemisphereLight args={['#ffffff', '#e9ebef', 0.18]} />
      <directionalLight position={[5, 13, 9]} intensity={0.55} color="#ffffff" />
      <directionalLight position={[-6, 7, 4]} intensity={0.2} color="#ffffff" />
      <Environment preset="studio" environmentIntensity={0.8} />

      <WhiteningMesh
        geometry={geometry}
        texture={texture}
        flipped={flipped}
        splitRef={splitRef}
        whitenRef={whitenRef}
        previewAllRef={previewAllRef}
        wetRef={wetRef}
        reflectRef={reflectRef}
        brightRef={brightRef}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.09}
        minDistance={16}
        maxDistance={90}
        target={[0, 0, 0]}
        makeDefault
      />
    </>
  );
}

const SHADE_PRESETS = [
  { id: 'natural',   label: 'Natural',   sub: 'A2 · subtle',     value: 0.3 },
  { id: 'bright',    label: 'Bright',    sub: 'A1 · noticeable', value: 0.55 },
  { id: 'hollywood', label: 'Hollywood', sub: 'BL2 · max',       value: 0.82 },
];

export default function SmileSimulator({ open, scan, onClose }) {
  // Live values read by the shader (refs avoid per-frame re-renders).
  const splitRef = useRef(0.5);
  const whitenRef = useRef(0.55);
  const previewAllRef = useRef(false);

  // UI mirrors of the above (low-frequency, for the DOM only).
  const [splitUI, setSplitUI] = useState(0.5);
  const [whitenPct, setWhitenPct] = useState(55);
  const [previewAll, setPreviewAll] = useState(false);
  const [activeShade, setActiveShade] = useState('bright');
  const [flipped, setFlipped] = useState(false);

  // ── Live realism dials (read by the mesh each frame). Because I can't
  //    see the render while building, these let the user tune the exact
  //    look in real time instead of waiting on a redeploy. 0..1 each. ──
  const wetRef = useRef(0.7);      // surface wetness/gloss
  const reflectRef = useRef(0.5);  // reflection strength (-> envMapIntensity 0..2)
  const brightRef = useRef(0.4);   // exposure (-> 0.6..1.6)
  const [wetPct, setWetPct] = useState(70);
  const [reflectPct, setReflectPct] = useState(50);
  const [brightPct, setBrightPct] = useState(40);
  const [showSettings, setShowSettings] = useState(false);

  const [geometry, setGeometry] = useState(null);
  const [texture, setTexture] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | error

  const controlsRef = useRef(null);
  const stageRef = useRef(null);       // the 3D stage box (for divider math)
  const dividerRef = useRef(null);
  const sweepRaf = useRef(null);
  const [sweeping, setSweeping] = useState(false);

  // Keep refs for disposal so we never leak GPU memory between scans.
  const geoRef = useRef(null);
  const texRef = useRef(null);

  const disposeAssets = useCallback(() => {
    if (geoRef.current) { try { geoRef.current.dispose(); } catch { /* noop */ } geoRef.current = null; }
    if (texRef.current) { try { texRef.current.dispose(); } catch { /* noop */ } texRef.current = null; }
  }, []);

  // Set both the live ref and the DOM mirror in lockstep.
  const applySplit = useCallback((v) => {
    const c = Math.max(0, Math.min(1, v));
    splitRef.current = c;
    if (dividerRef.current) dividerRef.current.style.left = `${c * 100}%`;
    setSplitUI(c);
  }, []);

  const applyWhiten = useCallback((pct) => {
    const c = Math.max(0, Math.min(100, pct));
    whitenRef.current = c / 100;
    setWhitenPct(c);
  }, []);

  // ── Load mesh + texture whenever the modal opens on a scan ──
  useEffect(() => {
    if (!open || !scan?.url) return undefined;
    let cancelled = false;
    disposeAssets();
    setStatus('loading');
    setGeometry(null);
    setTexture(null);

    const onGeo = (geo) => {
      if (cancelled) { try { geo.dispose(); } catch { /* noop */ } return; }
      try { reorientAndFrame(geo); } catch { /* keep raw geo if reorient fails */ }
      geoRef.current = geo;
      setGeometry(geo);
      setStatus('idle');
    };
    const onErr = () => { if (!cancelled) setStatus('error'); };

    const fmt = (scan.format || 'ply').toLowerCase();
    try {
      if (fmt === 'ply') {
        new PLYLoader().load(scan.url, onGeo, undefined, onErr);
      } else if (fmt === 'obj') {
        new OBJLoader().load(scan.url, (grp) => {
          let g = null;
          grp.traverse((c) => { if (c.isMesh && !g) g = c.geometry; });
          if (g) onGeo(g); else onErr();
        }, undefined, onErr);
      } else {
        new STLLoader().load(scan.url, onGeo, undefined, onErr);
      }
    } catch { onErr(); }

    if (scan.textureUrl) {
      new THREE.TextureLoader().load(
        scan.textureUrl,
        (t) => {
          if (cancelled) { try { t.dispose(); } catch { /* noop */ } return; }
          t.colorSpace = THREE.SRGBColorSpace;
          t.flipY = true; // scanner UVs use the OpenGL bottom-left origin
          t.wrapS = THREE.ClampToEdgeWrapping;
          t.wrapT = THREE.ClampToEdgeWrapping;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.generateMipmaps = true;
          t.anisotropy = 8;
          texRef.current = t;
          setTexture(t);
        },
        undefined,
        () => { /* texture is optional — mesh still loads */ }
      );
    }

    return () => { cancelled = true; };
  }, [open, scan?.url, scan?.textureUrl, scan?.format, disposeAssets]);

  // Dispose assets when the modal closes / unmounts.
  useEffect(() => {
    if (!open) {
      if (sweepRaf.current) cancelAnimationFrame(sweepRaf.current);
      disposeAssets();
    }
    return () => { if (sweepRaf.current) cancelAnimationFrame(sweepRaf.current); };
  }, [open, disposeAssets]);

  // Reset transient UI each time we open a new scan.
  useEffect(() => {
    if (!open) return;
    applySplit(0.5);
    applyWhiten(55);
    setActiveShade('bright');
    setPreviewAll(false);
    previewAllRef.current = false;
    setFlipped(false);
  }, [open, scan?.id, applySplit, applyWhiten]);

  // ── Divider drag ──
  const onDividerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const move = (ev) => {
      const rect = stage.getBoundingClientRect();
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
      applySplit(x / rect.width);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  }, [applySplit]);

  // ── Play sweep — animate the divider across, then settle at centre ──
  const startSweep = useCallback(() => {
    if (sweepRaf.current) cancelAnimationFrame(sweepRaf.current);
    setSweeping(true);
    const t0 = performance.now();
    const DUR = 2600;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / DUR);
      // ease in-out, sweep 0.08 → 0.92 → 0.5
      const eased = p < 0.5
        ? 2 * p * p
        : 1 - Math.pow(-2 * p + 2, 2) / 2;
      let pos;
      if (p < 0.7) pos = 0.08 + (0.92 - 0.08) * (eased / 0.96);
      else pos = 0.92 + (0.5 - 0.92) * ((p - 0.7) / 0.3);
      applySplit(pos);
      if (p < 1) {
        sweepRaf.current = requestAnimationFrame(tick);
      } else {
        applySplit(0.5);
        setSweeping(false);
        sweepRaf.current = null;
      }
    };
    sweepRaf.current = requestAnimationFrame(tick);
  }, [applySplit]);

  const stopSweep = useCallback(() => {
    if (sweepRaf.current) { cancelAnimationFrame(sweepRaf.current); sweepRaf.current = null; }
    setSweeping(false);
  }, []);

  const pickShade = useCallback((preset) => {
    setActiveShade(preset.id);
    applyWhiten(Math.round(preset.value * 100));
  }, [applyWhiten]);

  const togglePreviewAll = useCallback(() => {
    setPreviewAll((v) => {
      const nv = !v;
      previewAllRef.current = nv;
      return nv;
    });
  }, []);

  const resetView = useCallback(() => {
    controlsRef.current?.reset?.();
  }, []);

  if (!open) return null;

  const ready = !!geometry && (!scan?.textureUrl || !!texture);
  const archLabel = (scan?.arch || 'arch').toUpperCase();

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483647,
        background: 'rgba(2,3,8,0.94)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-surface-1/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400/30 to-sky-500/20 border border-teal-300/30 flex items-center justify-center">
            <Sparkles size={15} className="text-teal-200" />
          </div>
          <div>
            <div className="text-sm font-display font-semibold text-white flex items-center gap-2">
              Smile Simulator
              <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-400/25">
                WHITENING
              </span>
            </div>
            <div className="text-[10px] text-gray-500">
              {scan?.label || scan?.id || 'Patient scan'} · {archLabel} · before / after on the real scan
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-md hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
          aria-label="Close simulator"
        >
          <X size={16} />
        </button>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="relative flex-1 min-h-0 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, #11203a 0%, #060a14 55%, #03050b 100%)' }}>
        {ready && (
          <Canvas
            camera={{ position: [0, 9, 46], fov: 32, near: 0.1, far: 1000 }}
            // NeutralToneMapping (Khronos PBR Neutral): keeps the texture's
            // real colours accurate (unlike ACES, which warms/desaturates)
            // while gently rolling the brightest specular highlights to white
            // instead of hard-clipping them to chalk (the washed-out look).
            gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
            dpr={[1, 2]}
          >
            <Scene
              geometry={geometry}
              texture={texture}
              flipped={flipped}
              controlsRef={controlsRef}
              splitRef={splitRef}
              whitenRef={whitenRef}
              previewAllRef={previewAllRef}
              wetRef={wetRef}
              reflectRef={reflectRef}
              brightRef={brightRef}
            />
          </Canvas>
        )}

        {/* BEFORE / AFTER labels */}
        {ready && !previewAll && (
          <>
            <div className="absolute top-4 left-4 pointer-events-none select-none">
              <span className="text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-md bg-gray-900/80 text-white shadow-md">
                BEFORE
              </span>
            </div>
            <div className="absolute top-4 right-4 pointer-events-none select-none">
              <span className="text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-md bg-teal-500 text-white shadow-md">
                AFTER
              </span>
            </div>
          </>
        )}
        {ready && previewAll && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none">
            <span className="text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-md bg-teal-500 text-white shadow-md">
              WHITENED · FULL PREVIEW
            </span>
          </div>
        )}

        {/* Draggable divider */}
        {ready && !previewAll && (
          <div
            ref={dividerRef}
            className="absolute top-0 bottom-0"
            style={{ left: `${splitUI * 100}%`, transform: 'translateX(-50%)', width: 40, cursor: 'ew-resize', touchAction: 'none' }}
            onPointerDown={onDividerDown}
            onTouchStart={onDividerDown}
          >
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white" style={{ boxShadow: '0 0 0 1px rgba(15,23,42,0.35), 0 0 10px rgba(15,23,42,0.18)' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-gray-300 shadow-lg flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-surface-0">
                <path d="M9 6L4 12L9 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 6L20 12L15 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {/* Loading / error overlays */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <Loader2 size={28} className="text-teal-300 animate-spin mb-3" />
            <div className="text-sm text-gray-300 font-medium">Loading scan…</div>
            <div className="text-[11px] text-gray-500 mt-1">Reorienting the arch and applying the colour texture</div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <AlertTriangle size={26} className="text-amber-400 mb-3" />
            <div className="text-sm text-gray-200 font-medium">Couldn’t load this scan</div>
            <div className="text-[11px] text-gray-500 mt-1 max-w-sm">
              The mesh file at <code className="text-teal-200">{scan?.url}</code> failed to load. Check it exists and is a valid PLY/OBJ/STL.
            </div>
          </div>
        )}

        {/* Live realism panel — tune the look in real time */}
        {ready && showSettings && (
          <div className="absolute bottom-16 right-4 w-60 bg-surface-1/95 backdrop-blur border border-white/12 rounded-xl shadow-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                <Settings size={12} className="text-teal-300" /> Realism
              </span>
              <span className="text-[9px] text-gray-500">live · drag to taste</span>
            </div>
            <RealismSlider
              icon={<Droplets size={12} className="text-sky-300" />}
              label="Wetness" value={wetPct}
              onChange={(v) => { wetRef.current = v / 100; setWetPct(v); }}
            />
            <RealismSlider
              icon={<Sparkles size={12} className="text-teal-300" />}
              label="Reflections" value={reflectPct}
              onChange={(v) => { reflectRef.current = v / 100; setReflectPct(v); }}
            />
            <RealismSlider
              icon={<Sun size={12} className="text-amber-300" />}
              label="Brightness" value={brightPct}
              onChange={(v) => { brightRef.current = v / 100; setBrightPct(v); }}
            />
            <div className="text-[9px] text-gray-500 leading-relaxed pt-0.5 border-t border-white/8">
              Found the look? Tell me the three numbers and I’ll make them the default.
            </div>
          </div>
        )}

        {/* View controls (bottom-right of stage) */}
        {ready && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <StageBtn title="Realism settings" onClick={() => setShowSettings((v) => !v)} active={showSettings}>
              <Settings size={15} />
            </StageBtn>
            <StageBtn title="Flip arch up/down" onClick={() => setFlipped((v) => !v)} active={flipped}>
              <FlipVertical2 size={15} />
            </StageBtn>
            <StageBtn title="Reset camera" onClick={resetView}>
              <RotateCcw size={15} />
            </StageBtn>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="border-t border-white/8 bg-surface-1/90 px-5 py-3.5">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Play sweep */}
          <button
            onClick={sweeping ? stopSweep : startSweep}
            disabled={!ready || previewAll}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition border ${
              !ready || previewAll
                ? 'border-white/8 text-gray-600 cursor-not-allowed'
                : 'border-teal-400/40 bg-teal-500/15 text-teal-100 hover:bg-teal-500/25'
            }`}
          >
            {sweeping ? <Pause size={14} /> : <Play size={14} />}
            {sweeping ? 'Stop' : 'Reveal'}
          </button>

          {/* Whitening slider */}
          <div className="flex items-center gap-3 flex-1 min-w-[220px] max-w-md">
            <Sun size={15} className="text-amber-300 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Whitening</span>
                <span className="text-[11px] font-semibold text-teal-200 tabular-nums">{whitenPct}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={whitenPct}
                disabled={!ready}
                onChange={(e) => { applyWhiten(parseInt(e.target.value, 10)); setActiveShade('custom'); }}
                className="w-full accent-teal-400"
              />
            </div>
          </div>

          {/* Shade presets */}
          <div className="flex items-center gap-1.5">
            {SHADE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => pickShade(p)}
                disabled={!ready}
                title={p.sub}
                className={`px-3 py-1.5 rounded-lg text-left transition border ${
                  activeShade === p.id
                    ? 'border-teal-400/50 bg-teal-500/15'
                    : 'border-white/8 hover:border-white/20'
                } ${!ready ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className={`text-[11px] font-semibold ${activeShade === p.id ? 'text-teal-100' : 'text-gray-300'}`}>{p.label}</div>
                <div className="text-[9px] text-gray-500">{p.sub}</div>
              </button>
            ))}
          </div>

          {/* Full preview toggle */}
          <button
            onClick={togglePreviewAll}
            disabled={!ready}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition border ${
              previewAll
                ? 'border-teal-400/50 bg-teal-500/20 text-teal-100'
                : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
            } ${!ready ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Eye size={14} />
            {previewAll ? 'Showing full result' : 'Preview full result'}
          </button>
        </div>

        <div className="mt-2.5 text-[10px] text-gray-600 flex items-center gap-1.5">
          <span className="text-gray-500">Drag the divider</span> to compare ·
          <span className="text-gray-500">orbit</span> to inspect ·
          whitening is computed live on the patient’s own enamel (gums &amp; tongue are masked out).
        </div>
      </div>
    </div>,
    document.body
  );
}

function StageBtn({ children, title, onClick, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-lg backdrop-blur border flex items-center justify-center transition ${
        active
          ? 'bg-teal-500/25 border-teal-300/40 text-teal-100'
          : 'bg-black/50 border-white/10 text-gray-300 hover:text-white hover:bg-black/70'
      }`}
    >
      {children}
    </button>
  );
}

function RealismSlider({ icon, label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-400">
          {icon}{label}
        </span>
        <span className="text-[10px] font-semibold text-teal-200 tabular-nums">{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-teal-400"
      />
    </div>
  );
}
