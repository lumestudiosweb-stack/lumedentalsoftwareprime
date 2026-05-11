import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

/**
 * useXRayMaterial — modular hook that returns a memoized ShaderMaterial
 * mimicking a medical X-ray rendering of the scan mesh:
 *   • fresnel-based glowing silhouette edge (bright at grazing angles)
 *   • semi-transparent interior so cusps / overlapping teeth read
 *     through each other like an actual radiograph
 *   • cool bluish-white grayscale tone — clinical X-ray feel
 *   • additive blending so edges glow against the dark backdrop
 *
 * Cleanly disposes itself on unmount.
 *
 * Usage:
 *   const xRayMat = useXRayMaterial();
 *   <meshPhysicalMaterial ref={... regular ...} />  // when off
 *   // OR swap with: meshRef.current.material = xRayMat;
 */
export function useXRayMaterial() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor:        { value: new THREE.Color('#bfe4ff') },  // cool clinical white-blue
      uEdgeColor:    { value: new THREE.Color('#eaf6ff') },  // bright fresnel edge tint
      uFresnelPower: { value: 2.2 },
      uEdgeBoost:    { value: 1.6 },
      uInnerOpacity: { value: 0.10 },                        // faint inner glow
      uEdgeOpacity:  { value: 0.95 },                        // bright outer edge
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal  = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform vec3  uColor;
      uniform vec3  uEdgeColor;
      uniform float uFresnelPower;
      uniform float uEdgeBoost;
      uniform float uInnerOpacity;
      uniform float uEdgeOpacity;

      void main() {
        // Fresnel — 0 at facing-camera, 1 at grazing angle (silhouette).
        float ndotv = clamp(abs(dot(vNormal, vViewDir)), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, uFresnelPower);

        // Color: cool inner tone with brighter edge tint pushed by fresnel.
        vec3 col = mix(uColor, uEdgeColor, fresnel) * (0.35 + fresnel * uEdgeBoost);

        // Opacity: faint inside, bright at silhouette edges.
        float alpha = mix(uInnerOpacity, uEdgeOpacity, fresnel);

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }), []);

  // Dispose the GPU resources when the hook unmounts.
  useEffect(() => () => material.dispose(), [material]);

  return material;
}
