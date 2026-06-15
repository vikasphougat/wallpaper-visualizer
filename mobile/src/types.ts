export interface Wallpaper {
  id: string;
  name: string;
  texture: string;
  physicalRepeatCm: [number, number];
  accent: string;
  tileable?: boolean;
  source?: string;
}

export type NormPoint = { x: number; y: number };
export type Quad = [NormPoint, NormPoint, NormPoint, NormPoint];
