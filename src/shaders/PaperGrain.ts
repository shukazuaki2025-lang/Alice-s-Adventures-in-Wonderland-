import * as THREE from 'three';

/**
 * Procedural Paper Grain Overlay Material (#F7F3EA base with 15% noise grain)
 */
export function generatePaperGrainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base background paper color #F7F3EA
  ctx.fillStyle = '#F7F3EA';
  ctx.fillRect(0, 0, 512, 512);

  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;

  // Add 15% subtle paper noise grain
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 38; // ~15% of 255
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

export function createPaperGrainOverlayMaterial(): THREE.ShaderMaterial {
  const texture = generatePaperGrainTexture();
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tPaper: { value: texture },
      opacity: { value: 0.15 },
      vignetteRadius: { value: 1.5 }, // Large enough to be mostly off-screen by default
      colorGrade: { value: new THREE.Color(1.0, 1.0, 1.0) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tPaper;
      uniform float opacity;
      uniform float vignetteRadius;
      uniform vec3 colorGrade;
      varying vec2 vUv;
      void main() {
        // tDiffuse holds the scene in LINEAR HDR; grade, tone-map and sRGB-encode it here so highlights roll off
        // instead of clipping, then lay the paper tooth over the display-referred image.
        vec4 sceneColor = texture2D(tDiffuse, vUv);
        gl_FragColor = vec4(sceneColor.rgb * colorGrade, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>

        vec4 paper = texture2D(tPaper, vUv * 3.0);

        // Vignette calculation
        vec2 center = vUv - 0.5;
        float dist = length(center);
        float vignette = smoothstep(vignetteRadius - 0.2, vignetteRadius + 0.1, dist);

        vec3 blended = mix(gl_FragColor.rgb, gl_FragColor.rgb * paper.rgb, opacity);
        vec3 finalColor = mix(blended, vec3(0.0), vignette);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: false,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
}
