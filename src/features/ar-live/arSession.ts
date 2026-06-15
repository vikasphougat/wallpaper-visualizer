import * as THREE from "three";
import { XREstimatedLight } from "three/examples/jsm/webxr/XREstimatedLight.js";
import { compositeBeforeAfter } from "./arExport";
import { defaultPatchWidthM, textureRepeatForSize } from "@/lib/physicalScale";

/* WebXR types are accessed loosely via `any` to avoid requiring @types/webxr. */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Transform/skin info for the currently selected patch, sent to the UI. */
export interface PatchInfo {
  scale: number;
  rotationDeg: number;
  opacity: number;
  wallpaperId?: string;
}

/** Serializable patch for save/restore across reloads. */
export interface SerializedPatch {
  wallpaperId?: string;
  textureUrl: string;
  tileable: boolean;
  pose: number[];
  baseSize: [number, number];
  /** @deprecated use scaleX/scaleY — kept for older saved layouts */
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotDeg: number;
  opacity: number;
  physicalRepeatCm?: [number, number];
}

/** Screen-space handle positions for the selected patch overlay. */
export interface HandleOverlay {
  corners: { x: number; y: number }[];
  edges: { x: number; y: number }[];
}

export interface ARStartOptions {
  /** DOM-overlay root (WebXR uses it for the on-screen UI). */
  overlayRoot: HTMLElement;
  /** Full-screen transparent layer that captures placement/manipulation gestures. */
  gestureRoot: HTMLElement;
  /** Initial wallpaper used for the first placement. */
  textureUrl: string;
  wallpaperId?: string;
  tileable?: boolean;
  /**
   * Request WebXR depth-sensing for occlusion. OFF by default: three.js's
   * automatic occlusion path crashes the render loop on some Android depth
   * implementations (gpu-optimized vs CPU read mismatch). Opt in only when you
   * know the target device handles it.
   */
  enableOcclusion?: boolean;
  onPlaced?: () => void;
  onReticle?: (visible: boolean) => void;
  onDepth?: (enabled: boolean) => void;
  /** True when WebXR plane-detection is active (enables edge-to-edge fitting). */
  onWallFit?: (available: boolean) => void;
  /** True when the device supports WebXR anchors (user can opt in via the Lock button). */
  onAnchorsAvailable?: (available: boolean) => void;
  physicalRepeatCm?: [number, number];
  /** Fires when the selected patch changes (or is cleared) so the UI can sync. */
  onSelectPatch?: (info: PatchInfo | null) => void;
  /** Fires when the number of placed patches changes. */
  onCountChange?: (count: number) => void;
  /** Fires after any change to the layout (place/move/scale/delete/skin). */
  onLayoutChange?: (patches: SerializedPatch[]) => void;
  /** Screen positions of corner/edge handles for the selected patch (each frame). */
  onHandleOverlay?: (handles: HandleOverlay | null) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

/**
 * A placed wallpaper patch. `pose` is the surface/anchor transform (its +Y axis
 * is the outward normal); the mesh's final matrix = pose ∘ (in-plane rotation ∘
 * uniform scale). Each patch carries its own texture, so different walls can use
 * different wallpapers.
 */
interface PlacedPatch {
  mesh: THREE.Mesh;
  outline: THREE.LineSegments;
  material: THREE.MeshStandardMaterial;
  texture: THREE.Texture;
  pose: THREE.Matrix4;
  baseSize: [number, number];
  scaleX: number;
  scaleY: number;
  rotDeg: number;
  opacity: number;
  wallpaperId?: string;
  textureUrl: string;
  tileable: boolean;
  physicalRepeatCm: [number, number];
  /** WebXR anchor — keeps the patch locked to the real wall during the session. */
  anchor?: any;
  compareGroupId?: string;
}

/** A detected vertical wall plane, used for edge-to-edge fitting. */
interface DetectedWall {
  pose: THREE.Matrix4;
  size: [number, number];
  center: THREE.Vector3;
}

const NORMAL_HEIGHT_M = 1.6;
const COVER_SIZE: [number, number] = [3.2, 2.6];
const TAP_MOVE_PX = 10;
const TAP_MS = 500;
const HANDLE_HIT_PX = 52;
const MAX_WALL_M = 8;

type DragMode =
  | { kind: "move" }
  | { kind: "corner"; anchor: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3 }
  | { kind: "edge"; anchor: THREE.Vector3; axis: THREE.Vector3; perp: THREE.Vector3; origCenter: THREE.Vector3 };

/**
 * Real-time wall AR via WebXR + Three.js.
 *
 * Placement/manipulation are driven by DOM pointer events on a transparent
 * gesture layer (not WebXR `select`): tap empty space to place at the reticle,
 * tap a patch to select, drag to move, pinch to scale, twist to rotate.
 * Snap-to-wall averages recent hit-test poses; with plane-detection, "Cover
 * wall" fits the wallpaper edge-to-edge to the detected wall.
 */
export class ARSession {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private reticle!: THREE.Mesh;
  private placed: PlacedPatch[] = [];
  private selectedIndex = -1;

  private currentUrl = "";
  private currentId: string | undefined;
  private currentTileable = true;
  private physicalRepeatCm: [number, number] = [53, 53];
  private coverMode = false;
  private compareMode = false;
  private compareB = { url: "", id: "", tileable: true, physicalRepeatCm: [104, 104] as [number, number] };

  private hitTestSource: any = null;
  private lastHitResult: any = null;
  /** Device supports WebXR anchors. */
  private anchorsAvailable = false;
  /** User opted in — only then create/update anchors. Default off. */
  private useAnchors = false;
  private beforeSnapshot: string | null = null;
  private beforeCaptured = false;
  private localSpace: any = null;
  private session: any = null;
  private xrLight: XREstimatedLight | null = null;
  private opts: ARStartOptions | null = null;
  private reticleVisible = false;
  private lastViewerMatrix = new THREE.Matrix4();
  private hasViewerPose = false;

  private recentHits: { pos: THREE.Vector3; nrm: THREE.Vector3 }[] = [];
  private detectedWalls: DetectedWall[] = [];
  private planeDetection = false;

  private raycaster = new THREE.Raycaster();
  private gestureRoot: HTMLElement | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private downPos = { x: 0, y: 0 };
  private downTime = 0;
  private moved = false;
  private dragPatch: PlacedPatch | null = null;
  private dragMode: DragMode | null = null;
  private pinchStartDist = 0;
  private pinchStartAngle = 0;
  private pinchStartScaleX = 1;
  private pinchStartScaleY = 1;
  private pinchStartRot = 0;

  static async isSupported(): Promise<boolean> {
    const xr = (navigator as any).xr;
    if (!xr?.isSessionSupported) return false;
    try {
      return await xr.isSessionSupported("immersive-ar");
    } catch {
      return false;
    }
  }

  async start(opts: ARStartOptions): Promise<void> {
    this.opts = opts;
    this.currentUrl = opts.textureUrl;
    this.currentId = opts.wallpaperId;
    this.currentTileable = opts.tileable !== false;
    this.physicalRepeatCm = opts.physicalRepeatCm ?? [53, 53];
    THREE.Cache.enabled = true;

    const xr = (navigator as any).xr;
    if (!xr) {
      opts.onError?.("WebXR is not available on this device/browser.");
      return;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    this.renderer = renderer;

    const ring = new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2);
    this.reticle = new THREE.Mesh(
      ring,
      new THREE.MeshBasicMaterial({ color: 0x6ea8fe, transparent: true, opacity: 0.9 }),
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1));

    const xrLight = new XREstimatedLight(renderer);
    xrLight.addEventListener("estimationstart", () => {
      this.scene.add(xrLight);
      if (xrLight.environment) this.scene.environment = xrLight.environment;
    });
    xrLight.addEventListener("estimationend", () => {
      this.scene.remove(xrLight);
      this.scene.environment = null;
    });
    this.xrLight = xrLight;

    const optionalFeatures = [
      "dom-overlay",
      "light-estimation",
      "local-floor",
      "anchors",
      "plane-detection",
    ];
    const sessionInit: any = {
      requiredFeatures: ["hit-test"],
      optionalFeatures,
      domOverlay: { root: opts.overlayRoot },
    };
    if (opts.enableOcclusion) {
      optionalFeatures.push("depth-sensing");
      sessionInit.depthSensing = {
        usagePreference: ["gpu-optimized"],
        dataFormatPreference: ["luminance-alpha"],
      };
    }

    let session: any;
    try {
      session = await xr.requestSession("immersive-ar", sessionInit);
    } catch (e) {
      opts.onError?.(e instanceof Error ? e.message : "Could not start AR session.");
      this.cleanup();
      return;
    }
    this.session = session;

    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(session);

    opts.onDepth?.(Boolean(opts.enableOcclusion && session.depthUsage && session.depthDataFormat));
    this.planeDetection = (session.enabledFeatures ?? []).includes("plane-detection");
    this.anchorsAvailable = (session.enabledFeatures ?? []).includes("anchors");
    opts.onWallFit?.(this.planeDetection);
    opts.onAnchorsAvailable?.(this.anchorsAvailable);

    const viewerSpace = await session.requestReferenceSpace("viewer");
    this.localSpace = await session.requestReferenceSpace("local");
    try {
      this.hitTestSource = await session.requestHitTestSource({
        space: viewerSpace,
        entityTypes: ["plane", "point"],
      });
    } catch {
      this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    }

    session.addEventListener("end", () => {
      this.cleanup();
      this.opts?.onEnd?.();
    });

    this.attachGestures(opts.gestureRoot);
    renderer.setAnimationLoop((_t: number, frame: any) => this.onFrame(frame));
  }

  // ---- Wallpaper / mode -----------------------------------------------------

  setCurrentWallpaper(
    url: string,
    id?: string,
    tileable = true,
    physicalRepeatCm?: [number, number],
  ) {
    this.currentUrl = url;
    this.currentId = id;
    this.currentTileable = tileable;
    if (physicalRepeatCm) this.physicalRepeatCm = physicalRepeatCm;
    const p = this.selected();
    if (p) void this.reskin(p, url, id, tileable, physicalRepeatCm);
  }

  setCoverMode(on: boolean) {
    this.coverMode = on;
  }

  /**
   * Opt in to XR anchors so placed wallpaper locks to the real wall.
   * Off by default — normal tap-to-place works without anchors.
   */
  setUseAnchors(on: boolean) {
    this.useAnchors = on;
    if (!on) {
      for (const p of this.placed) {
        p.anchor?.delete?.();
        p.anchor = undefined;
      }
    }
  }

  get isUsingAnchors(): boolean {
    return this.useAnchors && this.anchorsAvailable;
  }

  setCompareMode(
    on: boolean,
    b?: { url: string; id?: string; tileable?: boolean; physicalRepeatCm?: [number, number] },
  ) {
    this.compareMode = on;
    if (b) {
      this.compareB = {
        url: b.url,
        id: b.id ?? "",
        tileable: b.tileable !== false,
        physicalRepeatCm: b.physicalRepeatCm ?? [104, 104],
      };
    }
  }

  /** Export side-by-side before/after PNG for customer sharing. */
  async exportBeforeAfter(): Promise<string | null> {
    const after = this.snapshot();
    if (!after) return null;
    if (this.beforeSnapshot) {
      return compositeBeforeAfter(this.beforeSnapshot, after);
    }
    return after;
  }

  get hasBeforeSnapshot(): boolean {
    return Boolean(this.beforeSnapshot);
  }

  // ---- Selected-patch adjustments ------------------------------------------

  setScale(s: number) {
    const p = this.selected();
    if (!p) return;
    p.scaleX = s;
    p.scaleY = s;
    this.applyTransform(p);
    this.emitLayout();
  }

  setRotation(deg: number) {
    const p = this.selected();
    if (!p) return;
    p.rotDeg = deg;
    this.applyTransform(p);
    this.emitLayout();
  }

  setOpacity(o: number) {
    const p = this.selected();
    if (!p) return;
    p.opacity = o;
    this.applyTransform(p);
    this.emitLayout();
  }

  /** Delete the currently selected patch. */
  removeSelected() {
    if (this.selectedIndex < 0) return;
    const [p] = this.placed.splice(this.selectedIndex, 1);
    if (p) this.disposePatch(p);
    this.select(Math.min(this.selectedIndex, this.placed.length - 1));
    this.opts?.onCountChange?.(this.placed.length);
    this.emitLayout();
  }

  removeLast() {
    const p = this.placed.pop();
    if (!p) return;
    this.disposePatch(p);
    this.select(this.placed.length - 1);
    this.opts?.onCountChange?.(this.placed.length);
    this.emitLayout();
  }

  clearPlaced() {
    this.disposeAll();
    this.opts?.onSelectPatch?.(null);
    this.opts?.onCountChange?.(0);
    this.emitLayout();
  }

  /** Dispose all patches without emitting a layout change (used on teardown). */
  private disposeAll() {
    this.placed.forEach((p) => this.disposePatch(p));
    this.placed = [];
    this.selectedIndex = -1;
  }

  placeInFront(distance = 1.6) {
    if (!this.hasViewerPose) return;
    const camPos = new THREE.Vector3().setFromMatrixPosition(this.lastViewerMatrix);
    const camQuat = new THREE.Quaternion().setFromRotationMatrix(this.lastViewerMatrix);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    const target = camPos.clone().add(forward.multiplyScalar(distance));
    const normal = camPos.clone().sub(target).normalize();
    void this.addPatch(this.wallPose(target, normal));
  }

  /**
   * Build a placement pose whose +Y axis is the wall normal AND whose in-plane
   * axes are aligned to world-up — so the rectangular patch reads as a proper
   * upright rectangle instead of a tilted "diamond". (`setFromUnitVectors`
   * leaves the roll about the normal arbitrary, which caused the tilt.)
   */
  private wallPose(pos: THREE.Vector3, normal: THREE.Vector3): THREE.Matrix4 {
    const n = normal.clone().normalize();
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(n.dot(up)) > 0.95) up = new THREE.Vector3(0, 0, 1); // floor/ceiling
    const tUp = up.clone().sub(n.clone().multiplyScalar(n.dot(up))).normalize(); // in-plane up
    const xAxis = new THREE.Vector3().crossVectors(n, tUp).normalize(); // in-plane horizontal
    const zAxis = new THREE.Vector3().crossVectors(xAxis, n).normalize();
    return new THREE.Matrix4().makeBasis(xAxis, n, zAxis).setPosition(pos);
  }

  snapshot(): string | null {
    if (!this.renderer) return null;
    try {
      return this.renderer.domElement.toDataURL("image/png");
    } catch {
      // A non-CORS texture would taint the canvas; Shopify CDN is CORS-safe so
      // this normally won't happen, but guard anyway.
      this.opts?.onError?.("Snapshot blocked (a wallpaper image isn't CORS-enabled).");
      return null;
    }
  }

  // ---- Save / restore -------------------------------------------------------

  serialize(): SerializedPatch[] {
    return this.placed.map((p) => ({
      wallpaperId: p.wallpaperId,
      textureUrl: p.textureUrl,
      tileable: p.tileable,
      pose: p.pose.toArray(),
      baseSize: p.baseSize,
      scaleX: p.scaleX,
      scaleY: p.scaleY,
      rotDeg: p.rotDeg,
      opacity: p.opacity,
      physicalRepeatCm: p.physicalRepeatCm,
    }));
  }

  async restore(patches: SerializedPatch[]) {
    for (const s of patches) {
      const pose = new THREE.Matrix4().fromArray(s.pose);
      await this.createPatch({
        pose,
        size: s.baseSize,
        url: s.textureUrl,
        id: s.wallpaperId,
        tileable: s.tileable,
        physicalRepeatCm: s.physicalRepeatCm ?? [104, 104],
        scaleX: s.scaleX ?? s.scale ?? 1,
        scaleY: s.scaleY ?? s.scale ?? 1,
        rotDeg: s.rotDeg,
        opacity: s.opacity,
        emit: false,
      });
    }
    this.emitLayout();
  }

  async end() {
    try {
      await this.session?.end();
    } catch {
      this.cleanup();
    }
  }

  // ---- Internal: patches ----------------------------------------------------

  private selected(): PlacedPatch | undefined {
    return this.placed[this.selectedIndex];
  }

  private select(index: number) {
    this.selectedIndex = index;
    this.placed.forEach((p, i) => (p.outline.visible = i === index));
    const p = this.placed[index];
    this.opts?.onSelectPatch?.(
      p
        ? {
            scale: (p.scaleX + p.scaleY) / 2,
            rotationDeg: p.rotDeg,
            opacity: p.opacity,
            wallpaperId: p.wallpaperId,
          }
        : null,
    );
    this.updateHandleOverlay();
  }

  private emitLayout() {
    this.opts?.onLayoutChange?.(this.serialize());
  }

  private repeatFor(
    size: [number, number],
    tileable: boolean,
    physicalRepeatCm: [number, number],
  ): [number, number] {
    return textureRepeatForSize(size, physicalRepeatCm, tileable);
  }

  private normalSize(): [number, number] {
    return [defaultPatchWidthM(this.physicalRepeatCm), NORMAL_HEIGHT_M];
  }

  private loadTextureFor(url: string, repeat: [number, number]): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        url,
        (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.repeat.set(repeat[0], repeat[1]);
          tex.center.set(0.5, 0.5);
          resolve(tex);
        },
        undefined,
        () => reject(new Error("Texture load failed")),
      );
    });
  }

  /** Place using the current brush + mode (fill wall / compare / anchor). */
  private async addPatch(pose: THREE.Matrix4) {
    if (this.compareMode) {
      await this.addComparePair(pose);
      this.opts?.onPlaced?.();
      return;
    }

    let usePose = pose;
    let size: [number, number] = this.coverMode ? COVER_SIZE : this.normalSize();

    // Fill wall: snap to detected vertical plane and size edge-to-edge.
    if (this.coverMode) {
      const wall = this.nearestWall(new THREE.Vector3().setFromMatrixPosition(pose));
      if (wall) {
        usePose = wall.pose.clone();
        size = wall.size;
      }
    }

    const anchor = await this.createAnchorFromLastHit();
    await this.createPatch({
      pose: usePose,
      size,
      url: this.currentUrl,
      id: this.currentId,
      tileable: this.currentTileable,
      physicalRepeatCm: this.physicalRepeatCm,
      scaleX: 1,
      scaleY: 1,
      rotDeg: 0,
      opacity: 1,
      anchor,
      emit: true,
    });
    this.opts?.onPlaced?.();
  }

  /** Two half-width patches side-by-side for A/B wallpaper comparison. */
  private async addComparePair(pose: THREE.Matrix4) {
    let usePose = pose;
    let size: [number, number] = this.coverMode ? COVER_SIZE : this.normalSize();
    if (this.coverMode) {
      const wall = this.nearestWall(new THREE.Vector3().setFromMatrixPosition(pose));
      if (wall) {
        usePose = wall.pose.clone();
        size = wall.size;
      }
    }
    const { right } = this.patchAxesFromPose(usePose);
    const center = new THREE.Vector3().setFromMatrixPosition(usePose);
    const halfW = size[0] * 0.5;
    const h = size[1];
    const groupId = `cmp-${Date.now()}`;
    const anchor = await this.createAnchorFromLastHit();

    const leftPose = usePose.clone();
    this.setPosePositionMatrix(leftPose, center.clone().add(right.clone().multiplyScalar(-size[0] * 0.25)));
    const rightPose = usePose.clone();
    this.setPosePositionMatrix(rightPose, center.clone().add(right.clone().multiplyScalar(size[0] * 0.25)));

    await this.createPatch({
      pose: leftPose,
      size: [halfW, h],
      url: this.currentUrl,
      id: this.currentId,
      tileable: this.currentTileable,
      physicalRepeatCm: this.physicalRepeatCm,
      scaleX: 1,
      scaleY: 1,
      rotDeg: 0,
      opacity: 1,
      anchor,
      compareGroupId: groupId,
      emit: false,
    });
    await this.createPatch({
      pose: rightPose,
      size: [halfW, h],
      url: this.compareB.url,
      id: this.compareB.id,
      tileable: this.compareB.tileable,
      physicalRepeatCm: this.compareB.physicalRepeatCm,
      scaleX: 1,
      scaleY: 1,
      rotDeg: 0,
      opacity: 1,
      compareGroupId: groupId,
      emit: true,
    });
  }

  private patchAxesFromPose(pose: THREE.Matrix4) {
    return {
      center: new THREE.Vector3().setFromMatrixPosition(pose),
      right: new THREE.Vector3().setFromMatrixColumn(pose, 0).normalize(),
      up: new THREE.Vector3().setFromMatrixColumn(pose, 2).normalize(),
      normal: new THREE.Vector3().setFromMatrixColumn(pose, 1).normalize(),
    };
  }

  private setPosePositionMatrix(pose: THREE.Matrix4, pos: THREE.Vector3) {
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    pose.decompose(new THREE.Vector3(), q, s);
    pose.compose(pos, q, new THREE.Vector3(1, 1, 1));
  }

  private async createAnchorFromLastHit(): Promise<any | undefined> {
    if (!this.useAnchors || !this.anchorsAvailable || !this.lastHitResult?.createAnchor) {
      return undefined;
    }
    try {
      return await this.lastHitResult.createAnchor();
    } catch {
      return undefined;
    }
  }

  private async createPatch(o: {
    pose: THREE.Matrix4;
    size: [number, number];
    url: string;
    id?: string;
    tileable: boolean;
    physicalRepeatCm: [number, number];
    scaleX: number;
    scaleY: number;
    rotDeg: number;
    opacity: number;
    anchor?: any;
    compareGroupId?: string;
    emit: boolean;
  }) {
    let texture: THREE.Texture;
    try {
      texture = await this.loadTextureFor(
        o.url,
        this.repeatFor(o.size, o.tileable, o.physicalRepeatCm),
      );
    } catch {
      this.opts?.onError?.("Could not load that wallpaper image.");
      return;
    }
    if (!this.renderer) {
      texture.dispose();
      return; // session ended while loading
    }

    const geo = new THREE.PlaneGeometry(o.size[0], o.size[1]).rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x6ea8fe }),
    );
    outline.visible = false;
    mesh.add(outline);
    this.scene.add(mesh);

    const patch: PlacedPatch = {
      mesh,
      outline,
      material,
      texture,
      pose: o.pose.clone(),
      baseSize: o.size,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotDeg: o.rotDeg,
      opacity: o.opacity,
      wallpaperId: o.id,
      textureUrl: o.url,
      tileable: o.tileable,
      physicalRepeatCm: o.physicalRepeatCm,
      anchor: o.anchor,
      compareGroupId: o.compareGroupId,
    };
    this.placed.push(patch);
    this.applyTransform(patch);
    this.select(this.placed.length - 1);
    this.opts?.onCountChange?.(this.placed.length);
    if (o.emit) this.emitLayout();
  }

  private async reskin(
    p: PlacedPatch,
    url: string,
    id: string | undefined,
    tileable: boolean,
    physicalRepeatCm?: [number, number],
  ) {
    let texture: THREE.Texture;
    const phys = physicalRepeatCm ?? p.physicalRepeatCm;
    try {
      texture = await this.loadTextureFor(url, this.repeatFor(p.baseSize, tileable, phys));
    } catch {
      return;
    }
    p.material.map = texture;
    p.material.needsUpdate = true;
    p.texture.dispose();
    p.texture = texture;
    p.wallpaperId = id;
    p.textureUrl = url;
    p.tileable = tileable;
    p.physicalRepeatCm = phys;
    this.emitLayout();
  }

  private applyTransform(p: PlacedPatch) {
    // Geometry is rotateX(-π/2) so width = local X, height = local Z (not Y).
    const local = new THREE.Matrix4()
      .makeRotationY((p.rotDeg * Math.PI) / 180)
      .multiply(new THREE.Matrix4().makeScale(p.scaleX, 1, p.scaleY));
    p.mesh.matrix.multiplyMatrices(p.pose, local);
    p.mesh.matrixWorldNeedsUpdate = true;
    p.material.transparent = p.opacity < 1;
    p.material.opacity = p.opacity;
    p.material.needsUpdate = true;
  }

  /** Corner/edge positions derived from the live mesh matrix (always matches what is rendered). */
  private geometryCorner(p: PlacedPatch, sx: -1 | 1, sz: -1 | 1): THREE.Vector3 {
    p.mesh.updateMatrixWorld(true);
    return new THREE.Vector3(sx * p.baseSize[0] * 0.5, 0, sz * p.baseSize[1] * 0.5).applyMatrix4(
      p.mesh.matrixWorld,
    );
  }

  private cornerWorld(p: PlacedPatch, ci: number): THREE.Vector3 {
    const signs: [-1 | 1, -1 | 1][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const [sx, sz] = signs[ci];
    return this.geometryCorner(p, sx, sz);
  }

  private edgeWorld(p: PlacedPatch, ei: number): THREE.Vector3 {
    const a = this.cornerWorld(p, ei);
    const b = this.cornerWorld(p, (ei + 1) % 4);
    return a.clone().add(b).multiplyScalar(0.5);
  }

  /** In-plane axes from the live mesh matrix (matches rendered geometry). */
  private patchAxes(p: PlacedPatch) {
    p.mesh.updateMatrixWorld(true);
    const m = p.mesh.matrixWorld;
    return {
      center: new THREE.Vector3().setFromMatrixPosition(m),
      right: new THREE.Vector3().setFromMatrixColumn(m, 0).normalize(),
      normal: new THREE.Vector3().setFromMatrixColumn(m, 1).normalize(),
      up: new THREE.Vector3().setFromMatrixColumn(m, 2).normalize(),
    };
  }

  private worldToScreen(v: THREE.Vector3, cam: THREE.Camera): { x: number; y: number } | null {
    const p = v.clone().project(cam);
    if (p.z > 1) return null; // behind camera
    return {
      x: ((p.x + 1) / 2) * window.innerWidth,
      y: ((-p.y + 1) / 2) * window.innerHeight,
    };
  }

  private handleOverlayFor(p: PlacedPatch): HandleOverlay | null {
    const cam = this.xrCamera();
    if (!cam) return null;
    const corners: { x: number; y: number }[] = [];
    const edges: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const c = this.worldToScreen(this.cornerWorld(p, i), cam);
      const e = this.worldToScreen(this.edgeWorld(p, i), cam);
      if (c) corners.push(c);
      if (e) edges.push(e);
    }
    return corners.length === 4 ? { corners, edges } : null;
  }

  private updateHandleOverlay() {
    const p = this.selected();
    this.opts?.onHandleOverlay?.(p ? this.handleOverlayFor(p) : null);
  }

  private pickHandleAt(x: number, y: number, p: PlacedPatch): DragMode | null {
    const overlay = this.handleOverlayFor(p);
    if (!overlay) return null;
    let best: { d: number; mode: DragMode } | null = null;

    const tryPoint = (px: number, py: number, mode: DragMode) => {
      const d = Math.hypot(x - px, y - py);
      if (d < HANDLE_HIT_PX && (!best || d < best.d)) best = { d, mode };
    };

    const { right, up, normal } = this.patchAxes(p);

    overlay.corners.forEach((pt, ci) => {
      const anchor = this.cornerWorld(p, (ci + 2) % 4);
      tryPoint(pt.x, pt.y, { kind: "corner", anchor, right, up });
    });

    overlay.edges.forEach((pt, ei) => {
      const { center } = this.patchAxes(p);
      if (ei === 0) {
        tryPoint(pt.x, pt.y, { kind: "edge", anchor: this.edgeWorld(p, 2), axis: up.clone().negate(), perp: right, origCenter: center.clone() });
      } else if (ei === 1) {
        tryPoint(pt.x, pt.y, { kind: "edge", anchor: this.edgeWorld(p, 3), axis: right, perp: up, origCenter: center.clone() });
      } else if (ei === 2) {
        tryPoint(pt.x, pt.y, { kind: "edge", anchor: this.edgeWorld(p, 0), axis: up, perp: right, origCenter: center.clone() });
      } else {
        tryPoint(pt.x, pt.y, { kind: "edge", anchor: this.edgeWorld(p, 1), axis: right.clone().negate(), perp: up, origCenter: center.clone() });
      }
    });

    return best?.mode ?? null;
  }

  private setPosePosition(p: PlacedPatch, pos: THREE.Vector3) {
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    p.pose.decompose(new THREE.Vector3(), q, s);
    p.pose.compose(pos, q, new THREE.Vector3(1, 1, 1));
  }

  private rayOnWallPlane(x: number, y: number, p: PlacedPatch): THREE.Vector3 | null {
    const cam = this.xrCamera();
    if (!cam) return null;
    this.raycaster.setFromCamera(this.ndc(x, y), cam);
    const { normal, center } = this.patchAxes(p);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  }

  private resizeFromCorner(p: PlacedPatch, mode: Extract<DragMode, { kind: "corner" }>, x: number, y: number) {
    const hit = this.rayOnWallPlane(x, y, p);
    if (!hit) return;
    const { anchor, right, up } = mode;
    const diag = hit.clone().sub(anchor);
    const w = Math.abs(diag.dot(right));
    const h = Math.abs(diag.dot(up));
    p.scaleX = THREE.MathUtils.clamp(w / p.baseSize[0], 0.15, 8);
    p.scaleY = THREE.MathUtils.clamp(h / p.baseSize[1], 0.15, 8);
    const center = anchor.clone().add(hit).multiplyScalar(0.5);
    this.setPosePosition(p, center);
    this.applyTransform(p);
  }

  private resizeFromEdge(p: PlacedPatch, mode: Extract<DragMode, { kind: "edge" }>, x: number, y: number) {
    const hit = this.rayOnWallPlane(x, y, p);
    if (!hit) return;
    const { anchor, axis, perp, origCenter } = mode;
    const extent = Math.max(0.15, hit.clone().sub(anchor).dot(axis));
    const isWidth = Math.abs(axis.dot(this.patchAxes(p).right)) > 0.9;
    if (isWidth) {
      p.scaleX = THREE.MathUtils.clamp(extent / p.baseSize[0], 0.15, 8);
    } else {
      p.scaleY = THREE.MathUtils.clamp(extent / p.baseSize[1], 0.15, 8);
    }
    const perpOff = perp.clone().multiplyScalar(origCenter.clone().sub(anchor).dot(perp));
    const center = anchor.clone().add(axis.clone().multiplyScalar(extent * 0.5)).add(perpOff);
    this.setPosePosition(p, center);
    this.applyTransform(p);
  }

  private syncPatchInfo(p: PlacedPatch) {
    this.opts?.onSelectPatch?.({
      scale: (p.scaleX + p.scaleY) / 2,
      rotationDeg: p.rotDeg,
      opacity: p.opacity,
      wallpaperId: p.wallpaperId,
    });
  }

  private disposePatch(p: PlacedPatch) {
    try {
      p.anchor?.delete?.();
    } catch {
      /* best-effort */
    }
    this.scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.material.dispose();
    p.texture.dispose();
    p.outline.geometry.dispose();
    (p.outline.material as THREE.Material).dispose();
  }

  /** Update patch poses from XR anchors (prevents drift while walking around). */
  private updateAnchoredPatches(frame: any) {
    if (!this.useAnchors || !this.anchorsAvailable) return;
    for (const p of this.placed) {
      if (!p.anchor?.anchorSpace) continue;
      const anchorPose = frame.getPose(p.anchor.anchorSpace, this.localSpace);
      if (!anchorPose) continue;
      const m = new THREE.Matrix4().fromArray(anchorPose.transform.matrix);
      const pos = new THREE.Vector3().setFromMatrixPosition(m);
      const nrm = new THREE.Vector3().setFromMatrixColumn(m, 1).normalize();
      p.pose.copy(this.wallPose(pos, nrm));
      this.applyTransform(p);
    }
  }

  private captureBeforeIfNeeded() {
    if (this.beforeCaptured || this.placed.length > 0) return;
    const url = this.snapshot();
    if (url) {
      this.beforeSnapshot = url;
      this.beforeCaptured = true;
    }
  }

  private placementPose(): THREE.Matrix4 | null {
    if (this.recentHits.length >= 3) {
      const pos = new THREE.Vector3();
      const nrm = new THREE.Vector3();
      for (const h of this.recentHits) {
        pos.add(h.pos);
        nrm.add(h.nrm);
      }
      pos.multiplyScalar(1 / this.recentHits.length);
      nrm.normalize();
      return this.wallPose(pos, nrm); // aligned to world-up (no diamond tilt)
    }
    if (this.reticleVisible) {
      const pos = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
      const nrm = new THREE.Vector3().setFromMatrixColumn(this.reticle.matrix, 1).normalize();
      return this.wallPose(pos, nrm);
    }
    return null;
  }

  private nearestWall(point: THREE.Vector3): DetectedWall | null {
    let best: DetectedWall | null = null;
    let bestDist = 2.5; // only snap to a wall within 2.5 m of the hit
    for (const w of this.detectedWalls) {
      const d = w.center.distanceTo(point);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    return best;
  }

  // ---- Internal: gestures ---------------------------------------------------

  private attachGestures(root: HTMLElement) {
    this.gestureRoot = root;
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointermove", this.onPointerMove);
    root.addEventListener("pointerup", this.onPointerUp);
    root.addEventListener("pointercancel", this.onPointerUp);
  }

  private detachGestures() {
    const root = this.gestureRoot;
    if (!root) return;
    root.removeEventListener("pointerdown", this.onPointerDown);
    root.removeEventListener("pointermove", this.onPointerMove);
    root.removeEventListener("pointerup", this.onPointerUp);
    root.removeEventListener("pointercancel", this.onPointerUp);
    this.gestureRoot = null;
  }

  private ndc(x: number, y: number): THREE.Vector2 {
    return new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  }

  private xrCamera(): THREE.Camera | null {
    if (!this.renderer) return null;
    const cam: any = this.renderer.xr.getCamera();
    return cam?.cameras?.[0] ?? cam ?? this.camera;
  }

  private pickPatch(x: number, y: number): number {
    const cam = this.xrCamera();
    if (!cam || !this.placed.length) return -1;
    this.raycaster.setFromCamera(this.ndc(x, y), cam);
    const hits = this.raycaster.intersectObjects(
      this.placed.map((p) => p.mesh),
      false,
    );
    if (!hits.length) return -1;
    return this.placed.findIndex((p) => p.mesh === hits[0].object);
  }

  private moveSelectedTo(x: number, y: number) {
    const p = this.selected();
    const cam = this.xrCamera();
    if (!p || !cam) return;
    this.raycaster.setFromCamera(this.ndc(x, y), cam);
    const { normal, center } = this.patchAxes(p);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, hit)) {
      const delta = hit.sub(center);
      const pos = new THREE.Vector3().setFromMatrixPosition(p.pose).add(delta);
      this.setPosePosition(p, pos);
      this.applyTransform(p);
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    try {
      this.gestureRoot?.setPointerCapture(e.pointerId);
    } catch {
      /* best-effort */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.downPos = { x: e.clientX, y: e.clientY };
      this.downTime = performance.now();
      this.moved = false;
      this.dragMode = null;

      const sel = this.selected();
      const handleOnSelected = sel ? this.pickHandleAt(e.clientX, e.clientY, sel) : null;
      if (handleOnSelected) {
        this.dragMode = handleOnSelected;
        this.dragPatch = sel!;
        return;
      }

      const idx = this.pickPatch(e.clientX, e.clientY);
      if (idx >= 0) {
        this.select(idx);
        const patch = this.placed[idx];
        const handleOnPatch = this.pickHandleAt(e.clientX, e.clientY, patch);
        if (handleOnPatch) {
          this.dragMode = handleOnPatch;
        } else {
          this.dragMode = { kind: "move" };
        }
        this.dragPatch = patch;
      } else {
        this.dragPatch = null;
      }
    } else if (this.pointers.size === 2) {
      this.dragPatch = null;
      this.dragMode = null;
      const sel = this.selected();
      const pts = [...this.pointers.values()];
      this.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.pinchStartAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      this.pinchStartScaleX = sel?.scaleX ?? 1;
      this.pinchStartScaleY = sel?.scaleY ?? 1;
      this.pinchStartRot = sel?.rotDeg ?? 0;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size >= 2) {
      this.moved = true;
      const sel = this.selected();
      if (sel && this.pinchStartDist > 0) {
        const pts = [...this.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        sel.scaleX = THREE.MathUtils.clamp(this.pinchStartScaleX * (dist / this.pinchStartDist), 0.2, 8);
        sel.scaleY = THREE.MathUtils.clamp(this.pinchStartScaleY * (dist / this.pinchStartDist), 0.2, 8);
        // Negate twist delta so rotation follows finger direction naturally.
        const rot = this.pinchStartRot - ((angle - this.pinchStartAngle) * 180) / Math.PI;
        sel.rotDeg = ((rot % 360) + 360) % 360;
        this.applyTransform(sel);
        this.syncPatchInfo(sel);
        this.updateHandleOverlay();
      }
      return;
    }

    const dx = e.clientX - this.downPos.x;
    const dy = e.clientY - this.downPos.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) this.moved = true;

    const sel = this.dragPatch;
    if (!sel || !this.moved || !this.dragMode) return;

    if (this.dragMode.kind === "corner") {
      this.resizeFromCorner(sel, this.dragMode, e.clientX, e.clientY);
      this.syncPatchInfo(sel);
      this.updateHandleOverlay();
    } else if (this.dragMode.kind === "edge") {
      this.resizeFromEdge(sel, this.dragMode, e.clientX, e.clientY);
      this.syncPatchInfo(sel);
      this.updateHandleOverlay();
    } else if (this.dragMode.kind === "move") {
      this.moveSelectedTo(e.clientX, e.clientY);
      this.updateHandleOverlay();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const wasAdjust =
      this.moved &&
      (this.dragMode !== null || this.pinchStartDist > 0);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size > 0) return;

    const dt = performance.now() - this.downTime;
    const wasTap = !this.moved && dt < TAP_MS;
    if (wasTap && !this.dragPatch) {
      const pose = this.placementPose();
      if (pose) void this.addPatch(pose);
    } else if (wasAdjust) {
      this.emitLayout();
    }
    this.dragPatch = null;
    this.dragMode = null;
    this.pinchStartDist = 0;
  };

  // ---- Internal: render loop ------------------------------------------------

  private onFrame(frame: any) {
    const renderer = this.renderer;
    if (!renderer || !frame) return;

    try {
      const viewerPose = frame.getViewerPose(this.localSpace);
      if (viewerPose) {
        this.lastViewerMatrix.fromArray(viewerPose.transform.matrix);
        this.hasViewerPose = true;
      }

      if (this.hitTestSource) {
        const results = frame.getHitTestResults(this.hitTestSource);
        this.lastHitResult = results.length ? results[0] : null;
        if (results.length) {
          const pose = results[0].getPose(this.localSpace);
          if (pose) {
            this.reticle.visible = true;
            this.reticle.matrix.fromArray(pose.transform.matrix);
            this.reticle.matrixWorldNeedsUpdate = true;
            if (!this.reticleVisible) {
              this.reticleVisible = true;
              this.opts?.onReticle?.(true);
            }
            const hitPos = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
            const hitNrm = new THREE.Vector3().setFromMatrixColumn(this.reticle.matrix, 1).normalize();
            this.recentHits.push({ pos: hitPos, nrm: hitNrm });
            if (this.recentHits.length > 12) this.recentHits.shift();
          }
        } else if (this.reticleVisible) {
          this.reticle.visible = false;
          this.reticleVisible = false;
          this.recentHits.length = 0;
          this.opts?.onReticle?.(false);
        }
      }

      if (this.planeDetection) this.updateDetectedWalls(frame);
      this.updateAnchoredPatches(frame);
      this.captureBeforeIfNeeded();
    } catch {
      // Swallow transient per-frame tracking errors; keep rendering.
    }

    this.updateHandleOverlay();
    renderer.render(this.scene, this.camera);
  }

  /** Read WebXR detected planes and cache vertical walls (for edge-to-edge). */
  private updateDetectedWalls(frame: any) {
    const planes = frame.detectedPlanes;
    if (!planes) return;
    const walls: DetectedWall[] = [];
    planes.forEach((plane: any) => {
      if (plane.orientation && plane.orientation.toLowerCase() !== "vertical") return;
      const pose = frame.getPose(plane.planeSpace, this.localSpace);
      if (!pose || !plane.polygon?.length) return;
      const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const pt of plane.polygon) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minZ = Math.min(minZ, pt.z);
        maxZ = Math.max(maxZ, pt.z);
      }
      const w = Math.min(MAX_WALL_M, maxX - minX);
      const h = Math.min(MAX_WALL_M, maxZ - minZ);
      if (w < 0.3 || h < 0.3) return;
      const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2).applyMatrix4(m);
      const poseAtCenter = m.clone().setPosition(center);
      walls.push({ pose: poseAtCenter, size: [w, h], center });
    });
    this.detectedWalls = walls;
  }

  private cleanup() {
    this.detachGestures();
    this.opts?.onHandleOverlay?.(null);
    this.renderer?.setAnimationLoop(null);
    this.hitTestSource?.cancel?.();
    this.hitTestSource = null;
    this.disposeAll();
    if (this.xrLight) this.scene.remove(this.xrLight);
    this.renderer?.dispose();
    this.renderer = null;
    this.session = null;
    this.hasViewerPose = false;
    this.reticleVisible = false;
    this.recentHits.length = 0;
    this.detectedWalls.length = 0;
    this.lastHitResult = null;
    this.beforeCaptured = false;
    this.beforeSnapshot = null;
    this.useAnchors = false;
    this.anchorsAvailable = false;
    this.pointers.clear();
  }
}
