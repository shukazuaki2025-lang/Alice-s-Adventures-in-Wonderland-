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
    const noise = (Math.random() - 0.5) * 22;
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
      tPaper: { value: texture },
      opacity: { value: 0.15 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tPaper;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        vec4 paper = texture2D(tPaper, vUv * 3.0);
        gl_FragColor = vec4(paper.rgb, opacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}
