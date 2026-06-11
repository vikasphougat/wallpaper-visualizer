export interface Wallpaper {
  id: string;
  name: string;
  /** Tileable texture URL (data URI or hosted asset). Used in WebGL + as a CSS background. */
  texture: string;
  /** Real-world tile size in centimetres: [rollWidth, patternRepeat]. Drives physical scale. */
  physicalRepeatCm: [number, number];
  /** Small accent color for UI chips / fallbacks. */
  accent: string;
  /**
   * Whether the texture tiles seamlessly. SVG catalog patterns do; product
   * photos (e.g. remote catalog shots) do not, so they're shown as a single
   * image stretched edge-to-edge rather than repeated with visible seams.
   * Treated as `true` when omitted.
   */
  tileable?: boolean;
  /** Optional source/credit label shown in the UI (e.g. a vendor name). */
  source?: string;
}

/** A point in normalised image space, where (0,0) is top-left and (1,1) is bottom-right. */
export interface NormPoint {
  x: number;
  y: number;
}

/** The four wall corners (clockwise from top-left) in normalised image space. */
export type Quad = [NormPoint, NormPoint, NormPoint, NormPoint];
