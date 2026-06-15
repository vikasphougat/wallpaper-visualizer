import { applyHomography, computeHomography, type Mat3 } from "@/lib/homography";

export interface RenderParams {
  /** Wall corners in normalised image space, order [TL, TR, BR, BL]. */
  quad: [number, number][];
  /** Pattern scale (larger = bigger motif, fewer tiles). */
  scale: number;
  rotationDeg: number;
  /** How strongly the wall's real shading shows through (0..1). */
  blend: number;
  opacity: number;
  /** Mean luminance of the photo (0..1), used to normalise the multiply blend. */
  meanLum: number;
}

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;       // clip-space position
in vec2 aUV;        // 0..1 across the wall
out vec2 vUV;
out vec2 vScreenUV; // 0..1 across the canvas, for sampling the photo
void main() {
  vUV = aUV;
  vScreenUV = vec2((aPos.x + 1.0) * 0.5, (1.0 - aPos.y) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_WALL = `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vScreenUV;
out vec4 fragColor;
uniform sampler2D uWall;
uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform vec2 uRepeat;
uniform float uRot;
uniform float uBlend;
uniform float uOpacity;
uniform float uMeanLum;
uniform float uUseMask;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  float maskA = 1.0;
  if (uUseMask > 0.5) {
    maskA = texture(uMask, vScreenUV).r;
    if (maskA < 0.04) discard;
  }
  vec2 p = vUV - 0.5;
  float ca = cos(uRot), sa = sin(uRot);
  p = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
  vec2 tc = (p + 0.5) * uRepeat;
  vec4 wp = texture(uWall, tc);
  float L = lum(texture(uPhoto, vScreenUV).rgb);
  float f = mix(1.0, L / max(uMeanLum, 0.001), uBlend);
  vec3 col = clamp(wp.rgb * f, 0.0, 1.0);
  fragColor = vec4(col, wp.a * uOpacity * maskA);
}`;

const FRAG_PHOTO = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uPhoto;
void main() { fragColor = texture(uPhoto, vUV); }`;

const GRID = 48; // wall subdivisions for perspective-correct tiling

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? "program link failed");
  }
  return p;
}

function makeTexture(
  gl: WebGL2RenderingContext,
  source: TexImageSource,
  repeat: boolean,
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (repeat) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  return tex;
}

export interface OverlayRenderer {
  setPhoto(bitmap: TexImageSource): void;
  setWallpaper(image: TexImageSource): void;
  /** Object-aware wall mask (0–255 per pixel, same aspect as photo). */
  setWallMask(data: Uint8Array | null, width: number, height: number): void;
  render(params: RenderParams): void;
  toBlob(type?: string): Promise<Blob | null>;
  dispose(): void;
}

export function createOverlayRenderer(canvas: HTMLCanvasElement): OverlayRenderer {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 is not available in this browser.");

  const wallProg = program(gl, VERT, FRAG_WALL);
  const photoProg = program(gl, VERT, FRAG_PHOTO);

  // Full-screen quad for the photo background.
  const photoVAO = gl.createVertexArray()!;
  gl.bindVertexArray(photoVAO);
  const photoBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, photoBuf);
  // interleaved: pos.xy, uv.xy  (uv flips with FLIP_Y already applied to texture)
  const fs = new Float32Array([
    -1, -1, 0, 1,
     1, -1, 1, 1,
     1,  1, 1, 0,
    -1,  1, 0, 0,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, fs, gl.STATIC_DRAW);
  bindPosUV(gl, photoProg);
  const photoIdx = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, photoIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // Wall grid geometry (positions rebuilt each render; UVs + indices are static).
  const wallVAO = gl.createVertexArray()!;
  gl.bindVertexArray(wallVAO);
  const wallBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, wallBuf);
  const vertCount = (GRID + 1) * (GRID + 1);
  const interleaved = new Float32Array(vertCount * 4);
  gl.bufferData(gl.ARRAY_BUFFER, interleaved.byteLength, gl.DYNAMIC_DRAW);
  bindPosUV(gl, wallProg);
  const wallIdxBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wallIdxBuf);
  const indices = buildGridIndices(GRID);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  let photoTex: WebGLTexture | null = null;
  let wallTex: WebGLTexture | null = null;
  let maskTex: WebGLTexture | null = null;
  let maskSize = { w: 0, h: 0 };
  let useMask = false;

  function setPhoto(source: TexImageSource) {
    if (photoTex) gl!.deleteTexture(photoTex);
    photoTex = makeTexture(gl!, source, false);
  }
  function setWallpaper(source: TexImageSource) {
    if (wallTex) gl!.deleteTexture(wallTex);
    wallTex = makeTexture(gl!, source, true);
  }

  function setWallMask(data: Uint8Array | null, width: number, height: number) {
    if (maskTex) {
      gl!.deleteTexture(maskTex);
      maskTex = null;
    }
    useMask = false;
    if (!data || !width || !height) return;

    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);

    try {
      gl!.texImage2D(
        gl!.TEXTURE_2D,
        0,
        gl!.R8,
        width,
        height,
        0,
        gl!.RED,
        gl!.UNSIGNED_BYTE,
        data,
      );
    } catch {
      // Fallback for GPUs without R8 single-channel textures.
      const rgba = new Uint8Array(width * height * 4);
      for (let i = 0; i < data.length; i++) {
        rgba[i * 4] = data[i];
      }
      gl!.texImage2D(
        gl!.TEXTURE_2D,
        0,
        gl!.RGBA,
        width,
        height,
        0,
        gl!.RGBA,
        gl!.UNSIGNED_BYTE,
        rgba,
      );
    }

    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    maskTex = tex;
    maskSize = { w: width, h: height };
    useMask = true;
  }

  function render(params: RenderParams) {
    const w = canvas.width;
    const h = canvas.height;
    gl!.viewport(0, 0, w, h);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    // 1) Photo background
    if (photoTex) {
      gl!.disable(gl!.BLEND);
      gl!.useProgram(photoProg);
      gl!.bindVertexArray(photoVAO);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, photoTex);
      gl!.uniform1i(gl!.getUniformLocation(photoProg, "uPhoto"), 0);
      gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0);
    }

    // 2) Wallpaper over the wall quad
    if (wallTex && photoTex) {
      // Rebuild grid positions from the current quad homography.
      const H: Mat3 = computeHomography(
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        params.quad.map(([x, y]) => [x * w, y * h]) as [number, number][],
      );
      let k = 0;
      for (let j = 0; j <= GRID; j++) {
        for (let i = 0; i <= GRID; i++) {
          const s = i / GRID;
          const t = j / GRID;
          const [px, py] = applyHomography(H, s, t);
          interleaved[k++] = (px / w) * 2 - 1; // clip x
          interleaved[k++] = 1 - (py / h) * 2; // clip y
          interleaved[k++] = s;
          interleaved[k++] = t;
        }
      }
      gl!.bindVertexArray(wallVAO);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, wallBuf);
      gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, interleaved);

      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
      gl!.useProgram(wallProg);

      // Keep tiles roughly square: derive Y repeat from quad pixel aspect ratio.
      const quadPx = params.quad.map(([x, y]) => [x * w, y * h]) as [number, number][];
      const widthPx = (dist(quadPx[0], quadPx[1]) + dist(quadPx[3], quadPx[2])) / 2;
      const heightPx = (dist(quadPx[0], quadPx[3]) + dist(quadPx[1], quadPx[2])) / 2;
      const tilesX = 8 / Math.max(0.2, params.scale);
      const tilesY = tilesX * (heightPx / Math.max(1, widthPx));

      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, wallTex);
      gl!.uniform1i(gl!.getUniformLocation(wallProg, "uWall"), 0);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, photoTex);
      gl!.uniform1i(gl!.getUniformLocation(wallProg, "uPhoto"), 1);
      if (useMask && maskTex) {
        gl!.activeTexture(gl!.TEXTURE2);
        gl!.bindTexture(gl!.TEXTURE_2D, maskTex);
        gl!.uniform1i(gl!.getUniformLocation(wallProg, "uMask"), 2);
        gl!.uniform1f(gl!.getUniformLocation(wallProg, "uUseMask"), 1);
      } else {
        gl!.uniform1f(gl!.getUniformLocation(wallProg, "uUseMask"), 0);
      }
      gl!.uniform2f(gl!.getUniformLocation(wallProg, "uRepeat"), tilesX, tilesY);
      gl!.uniform1f(gl!.getUniformLocation(wallProg, "uRot"), (params.rotationDeg * Math.PI) / 180);
      gl!.uniform1f(gl!.getUniformLocation(wallProg, "uBlend"), params.blend);
      gl!.uniform1f(gl!.getUniformLocation(wallProg, "uOpacity"), params.opacity);
      gl!.uniform1f(gl!.getUniformLocation(wallProg, "uMeanLum"), params.meanLum);

      gl!.drawElements(gl!.TRIANGLES, indices.length, gl!.UNSIGNED_SHORT, 0);
    }

    gl!.bindVertexArray(null);
  }

  function toBlob(type = "image/png"): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type));
  }

  function dispose() {
    if (photoTex) gl!.deleteTexture(photoTex);
    if (wallTex) gl!.deleteTexture(wallTex);
    if (maskTex) gl!.deleteTexture(maskTex);
    gl!.deleteProgram(wallProg);
    gl!.deleteProgram(photoProg);
    gl!.deleteBuffer(photoBuf);
    gl!.deleteBuffer(photoIdx);
    gl!.deleteBuffer(wallBuf);
    gl!.deleteBuffer(wallIdxBuf);
  }

  return { setPhoto, setWallpaper, setWallMask, render, toBlob, dispose };
}

function bindPosUV(gl: WebGL2RenderingContext, prog: WebGLProgram) {
  const aPos = gl.getAttribLocation(prog, "aPos");
  const aUV = gl.getAttribLocation(prog, "aUV");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
}

function buildGridIndices(grid: number): Uint16Array {
  const idx: number[] = [];
  const stride = grid + 1;
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  return new Uint16Array(idx);
}

function dist(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
