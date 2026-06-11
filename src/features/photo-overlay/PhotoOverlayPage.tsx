import { useCallback, useEffect, useRef, useState } from "react";
import { useSelection } from "@/stores/selection";
import { loadImage, loadOrientedBitmap, meanLuminance } from "@/lib/image";
import { defaultQuad } from "@/lib/homography";
import { createOverlayRenderer, type OverlayRenderer } from "./overlayRenderer";
import { CornerHandles } from "./CornerHandles";

const MAX_DPR = 2;

export default function PhotoOverlayPage() {
  const { wallpaper, scale, rotationDeg, blend, opacity, set } = useSelection();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OverlayRenderer | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const meanLumRef = useRef(0.5);

  const [quad, setQuad] = useState<[number, number][]>(defaultQuad());
  const [hasPhoto, setHasPhoto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-render whenever any visual parameter changes.
  const draw = useCallback(() => {
    rendererRef.current?.render({
      quad,
      scale,
      rotationDeg,
      blend,
      opacity,
      meanLum: meanLumRef.current,
    });
  }, [quad, scale, rotationDeg, blend, opacity]);

  useEffect(() => {
    draw();
  }, [draw, wallpaper]);

  // Size the canvas to its stage while preserving the photo's aspect ratio.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const bmp = bitmapRef.current;
    if (!canvas || !stage || !bmp) return;
    const cssW = stage.clientWidth;
    const cssH = cssW * (bmp.height / bmp.width);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeCanvas]);

  useEffect(() => () => rendererRef.current?.dispose(), []);

  async function onPickPhoto(file: File) {
    setError(null);
    setBusy("Loading photo…");
    try {
      const bmp = await loadOrientedBitmap(file);
      bitmapRef.current = bmp;
      meanLumRef.current = meanLuminance(bmp);

      if (!rendererRef.current && canvasRef.current) {
        rendererRef.current = createOverlayRenderer(canvasRef.current);
      }
      rendererRef.current!.setPhoto(bmp);
      const wp = await loadImage(wallpaper.texture);
      rendererRef.current!.setWallpaper(wp);

      setQuad(defaultQuad());
      setHasPhoto(true);
      resizeCanvas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that image.");
    } finally {
      setBusy(null);
    }
  }

  // Swap wallpaper texture into the renderer when the selection changes.
  useEffect(() => {
    let cancelled = false;
    if (!rendererRef.current) return;
    loadImage(wallpaper.texture).then((img) => {
      if (cancelled) return;
      rendererRef.current!.setWallpaper(img);
      draw();
    });
    return () => {
      cancelled = true;
    };
  }, [wallpaper.texture, draw]);

  async function onAutoDetect() {
    if (!bitmapRef.current) return;
    setError(null);
    setBusy("Detecting wall… (first run downloads the model)");
    try {
      const { detectWallQuad } = await import("./segmentation");
      const q = await detectWallQuad(bitmapRef.current);
      setQuad(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-detect failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onExport() {
    const blob = await rendererRef.current?.toBlob("image/png");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wall-${wallpaper.id}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="page">
      <h2 className="page__heading">2D Photo Overlay</h2>
      <p className="page__sub">
        Add a photo of your wall, drag the four corners onto the wall, and the wallpaper is warped to
        match — keeping the room's real shadows.
      </p>

      <div className="photo">
        <div className="photo__stage" ref={stageRef}>
          {!hasPhoto && (
            <label className="dropzone">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0])}
              />
              <span className="dropzone__glyph" aria-hidden>＋</span>
              <span>Upload or take a photo of your wall</span>
            </label>
          )}
          <canvas ref={canvasRef} className={`photo__canvas${hasPhoto ? " is-on" : ""}`} />
          {hasPhoto && <CornerHandles quad={quad} onChange={setQuad} />}
          {busy && <div className="photo__busy">{busy}</div>}
        </div>

        {hasPhoto && (
          <div className="controls">
            <div className="controls__row">
              <label>
                Pattern size
                <input
                  type="range" min={0.3} max={3} step={0.05} value={scale}
                  onChange={(e) => set({ scale: Number(e.target.value) })}
                />
              </label>
              <label>
                Rotation
                <input
                  type="range" min={0} max={360} step={1} value={rotationDeg}
                  onChange={(e) => set({ rotationDeg: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="controls__row">
              <label>
                Lighting blend
                <input
                  type="range" min={0} max={1} step={0.02} value={blend}
                  onChange={(e) => set({ blend: Number(e.target.value) })}
                />
              </label>
              <label>
                Opacity
                <input
                  type="range" min={0.1} max={1} step={0.02} value={opacity}
                  onChange={(e) => set({ opacity: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="controls__actions">
              <button className="btn" onClick={onAutoDetect}>Auto-detect wall (beta)</button>
              <button className="btn" onClick={() => setQuad(defaultQuad())}>Reset corners</button>
              <label className="btn">
                Change photo
                <input
                  type="file" accept="image/*" hidden
                  onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0])}
                />
              </label>
              <button className="btn btn--primary" onClick={onExport}>Download PNG</button>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
