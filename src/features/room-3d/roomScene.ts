import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type LightingPreset = "apartment" | "daylight" | "evening";
export type WallId = "back" | "left" | "right";

export interface RoomSceneOptions {
  width?: number; // metres
  height?: number;
  depth?: number;
}

interface WallEntry {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
}

const PRESETS: Record<LightingPreset, { ambient: number; key: number; sky: number; ground: number; color: number }> = {
  apartment: { ambient: 0.55, key: 0.9, sky: 0.5, ground: 0.25, color: 0xfff2e0 },
  daylight: { ambient: 0.75, key: 1.25, sky: 0.8, ground: 0.4, color: 0xffffff },
  evening: { ambient: 0.35, key: 0.7, sky: 0.3, ground: 0.2, color: 0xffd8a8 },
};

/**
 * A self-contained procedural room rendered with raw Three.js. Three walls + floor,
 * orbit controls, and a wallpaper texture mapped onto chosen walls. No external GLB
 * asset required, so it works offline and avoids r3f/React-19 version coupling.
 */
export class RoomScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private walls: Record<WallId, WallEntry>;
  private floorMat: THREE.MeshStandardMaterial;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private texture: THREE.Texture | null = null;
  private papered: Set<WallId> = new Set(["back", "left", "right"]);
  private paintColor = new THREE.Color(0xece7df);
  private repeat: [number, number] = [3, 2];
  private rotationRad = 0;
  private raf = 0;
  private readonly w: number;
  private readonly h: number;
  private readonly d: number;
  private readonly home = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, opts: RoomSceneOptions = {}) {
    this.w = opts.width ?? 4;
    this.h = opts.height ?? 2.7;
    this.d = opts.depth ?? 4;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12151c);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    this.camera.position.set(0, this.h * 0.55, this.d * 0.95);
    this.home.copy(this.camera.position);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, this.h * 0.45, -this.d * 0.2);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = this.d * 2.2;
    this.controls.maxPolarAngle = Math.PI * 0.52; // don't go under the floor

    // Lights
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.5);
    this.key = new THREE.DirectionalLight(0xfff2e0, 0.9);
    this.key.position.set(this.w * 0.6, this.h * 1.6, this.d * 0.6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 30;
    this.scene.add(this.ambient, this.hemi, this.key);

    // Floor
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0x6f6257, roughness: 0.95, metalness: 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(this.w, this.d), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Walls (planes facing into the room)
    this.walls = {
      back: this.makeWall(this.w, this.h, [0, this.h / 2, -this.d / 2], [0, 0, 0]),
      left: this.makeWall(this.d, this.h, [-this.w / 2, this.h / 2, 0], [0, Math.PI / 2, 0]),
      right: this.makeWall(this.d, this.h, [this.w / 2, this.h / 2, 0], [0, -Math.PI / 2, 0]),
    };

    this.applyLighting("apartment");
    this.resize();
    this.start();
  }

  private makeWall(
    planeW: number,
    planeH: number,
    pos: [number, number, number],
    rot: [number, number, number],
  ): WallEntry {
    const material = new THREE.MeshStandardMaterial({
      color: this.paintColor.clone(),
      roughness: 0.88,
      metalness: 0,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), material);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return { mesh, material };
  }

  /** Load a wallpaper texture from a URL (data URI or file) and apply to papered walls. */
  setWallpaper(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          this.texture?.dispose();
          this.texture = tex;
          this.refreshWalls();
          resolve();
        },
        undefined,
        () => reject(new Error("Failed to load wallpaper texture")),
      );
    });
  }

  setRepeat(x: number, y: number) {
    this.repeat = [x, y];
    if (this.texture) {
      this.texture.repeat.set(x, y);
      this.texture.needsUpdate = true;
    }
  }

  setRotation(deg: number) {
    this.rotationRad = (deg * Math.PI) / 180;
    if (this.texture) {
      this.texture.center.set(0.5, 0.5);
      this.texture.rotation = this.rotationRad;
      this.texture.needsUpdate = true;
    }
  }

  /** Toggle which walls show wallpaper vs. plain paint. */
  setPaperedWalls(walls: WallId[]) {
    this.papered = new Set(walls);
    this.refreshWalls();
  }

  /** Plain paint color for non-papered walls. */
  setPaintColor(hex: string) {
    this.paintColor.set(hex);
    this.refreshWalls();
  }

  applyLighting(preset: LightingPreset) {
    const p = PRESETS[preset];
    this.ambient.intensity = p.ambient;
    this.hemi.intensity = (p.sky + p.ground) / 2;
    this.hemi.color.setHex(0xffffff);
    this.key.intensity = p.key;
    this.key.color.setHex(p.color);
  }

  resetView() {
    this.camera.position.copy(this.home);
    this.controls.target.set(0, this.h * 0.45, -this.d * 0.2);
    this.controls.update();
  }

  /** Returns a PNG data URL of the current frame. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  resize() {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = Math.max(320, Math.round(parent.clientWidth * 0.7));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private refreshWalls() {
    (Object.keys(this.walls) as WallId[]).forEach((id) => {
      const mat = this.walls[id].material;
      if (this.papered.has(id) && this.texture) {
        mat.map = this.texture;
        mat.color.setHex(0xffffff);
      } else {
        mat.map = null;
        mat.color.copy(this.paintColor);
      }
      mat.needsUpdate = true;
    });
  }

  private start() {
    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.texture?.dispose();
    this.floorMat.dispose();
    (Object.values(this.walls) as WallEntry[]).forEach((w) => {
      w.material.dispose();
      w.mesh.geometry.dispose();
    });
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.renderer.dispose();
  }
}
