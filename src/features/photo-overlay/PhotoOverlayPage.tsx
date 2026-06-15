import { useCallback, useEffect, useRef, useState } from "react";
import { useSelection } from "@/stores/selection";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { loadImage, preparePhotoBitmap, meanLuminance } from "@/lib/image";
import { defaultQuad } from "@/lib/homography";
import { createOverlayRenderer, type OverlayRenderer } from "./overlayRenderer";
import { CornerHandles } from "./CornerHandles";

const MAX_DPR = 2;
const VIEW_ZOOM_MIN = 0.6;
const VIEW_ZOOM_MAX = 2.4;
const VIEW_ZOOM_STEP = 0.12;

export default function PhotoOverlayPage() {
  const { wallpaper, scale, rotationDeg, blend, opacity, set, select } = useSelection();
  const { library } = useWallpaperLibrary();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const rendererRef = useRef<OverlayRenderer | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const meanLumRef = useRef(0.5);

  const [quad, setQuad] = useState<[number, number][]>(defaultQuad());
  const [hasPhoto, setHasPhoto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [viewZoom, setViewZoom] = useState(1);
  const [mlReady, setMlReady] = useState<boolean | null>(null);

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
    import("./segmentation").then((m) => m.isMlAvailable().then(setMlReady));
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const bmp = bitmapRef.current;
    if (!canvas || !stage || !bmp) return;

    const vw = stage.clientWidth;
    const vh = stage.clientHeight;
    const aspect = bmp.width / bmp.height;
    let cssW = vw;
    let cssH = vw / aspect;
    if (cssH > vh) {
      cssH = vh;
      cssW = vh * aspect;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    draw();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw, wallpaper]);

  useEffect(() => {
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeCanvas]);

  useEffect(() => {
    document.body.classList.toggle("photo-immersive", hasPhoto);
    return () => document.body.classList.remove("photo-immersive");
  }, [hasPhoto]);

  useEffect(() => () => {
    rendererRef.current?.dispose();
    bitmapRef.current?.close();
  }, []);

  async function onPickPhoto(file: File, input?: HTMLInputElement | null) {
    setError(null);
    setBusy("Loading photo…");
    try {
      const bmp = await preparePhotoBitmap(file);
      bitmapRef.current?.close();
      bitmapRef.current = bmp;
      meanLumRef.current = meanLuminance(bmp);

      setHasPhoto(true);
      setPickerOpen(false);
      setAdjustOpen(false);
      setViewZoom(1);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      if (!rendererRef.current && canvasRef.current) {
        rendererRef.current = createOverlayRenderer(canvasRef.current);
      }
      rendererRef.current!.setPhoto(bmp);
      const wp = await loadImage(wallpaper.texture);
      rendererRef.current!.setWallpaper(wp);

      setQuad(defaultQuad());
      resizeCanvas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that image.");
    } finally {
      setBusy(null);
      if (input) input.value = "";
    }
  }

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

  useEffect(() => {
    if (hasPhoto) resizeCanvas();
  }, [hasPhoto, resizeCanvas]);

  async function onAutoDetect() {
    if (!bitmapRef.current) return;
    setError(null);
    setBusy("Detecting wall…");
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

  function zoomView(delta: number) {
    setViewZoom((z) =>
      Math.min(VIEW_ZOOM_MAX, Math.max(VIEW_ZOOM_MIN, Number((z + delta).toFixed(2)))),
    );
  }

  function clearPhoto() {
    rendererRef.current?.dispose();
    rendererRef.current = null;
    bitmapRef.current?.close();
    bitmapRef.current = null;
    setHasPhoto(false);
    setQuad(defaultQuad());
    setPickerOpen(false);
    setAdjustOpen(false);
    setViewZoom(1);
    setError(null);
  }

  function togglePicker() {
    setPickerOpen((o) => {
      const next = !o;
      if (next) setAdjustOpen(false);
      return next;
    });
  }

  function toggleAdjust() {
    setAdjustOpen((o) => {
      const next = !o;
      if (next) setPickerOpen(false);
      return next;
    });
  }

  /* ---- Idle: pick a photo first ---- */
  if (!hasPhoto) {
    return (
      <section className="page">
        <h2 className="page__heading">2D Photo Overlay</h2>
        <p className="page__sub page__sub--compact">
          Take or upload a wall photo, then drag corners to fit the wallpaper.
        </p>

        <div className="photo-idle">
          <div className="photo-idle__hero">
            <span className="photo-idle__glyph" aria-hidden>📷</span>
            <p>Add a photo of your wall</p>
          </div>

          <div className="ar-dock photo-idle__dock">
            <button
              type="button"
              className={`ar-dock__side${pickerOpen ? " is-on" : ""}`}
              onClick={togglePicker}
              aria-label="Choose wallpaper"
            >
              <span
                className="ar-dock__thumb"
                style={{ backgroundImage: `url("${wallpaper.texture}")` }}
                aria-hidden
              />
            </button>
            <button
              type="button"
              className="ar-dock__shutter"
              onClick={() => cameraRef.current?.click()}
              aria-label="Take photo"
            >
              <span className="ar-dock__shutter-ring" aria-hidden />
            </button>
            <button
              type="button"
              className="ar-dock__side ar-dock__side--icon"
              onClick={() => galleryRef.current?.click()}
              aria-label="From gallery"
            >
              🖼
            </button>
          </div>

          {pickerOpen && (
            <div className="ar-overlay__tray photo-idle__tray">
              {library.map((w) => (
                <button
                  key={w.id}
                  className={`ar-swatch${w.id === wallpaper.id ? " is-active" : ""}`}
                  style={{ backgroundImage: `url("${w.texture}")` }}
                  onClick={() => {
                    select(w);
                    setPickerOpen(false);
                  }}
                  title={w.name}
                >
                  <span className="ar-swatch__name">{w.name}</span>
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="error">
              {error}
              <button type="button" className="error__dismiss" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
            </p>
          )}
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0], e.target)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0], e.target)}
        />
      </section>
    );
  }

  /* ---- Immersive editor (AR-style HUD) ---- */
  return (
    <section className="photo-hud">
      <div className="photo-hud__stage-wrap" ref={stageRef}>
        <div
          className="photo-hud__zoom"
          style={{ transform: `scale(${viewZoom})` }}
        >
          <div className="photo-hud__canvas-wrap">
            <canvas ref={canvasRef} className="photo__canvas is-on" />
            <CornerHandles quad={quad} onChange={setQuad} />
          </div>
        </div>
        {busy && <div className="photo__busy">{busy}</div>}
      </div>

      <div className="ar-hud__top photo-hud__chrome">
        <button
          type="button"
          className="ar-hud__icon"
          onClick={clearPhoto}
          aria-label="Close photo"
        >
          ✕
        </button>
        <span className="ar-hud__chip">{wallpaper.name}</span>
        <button
          type="button"
          className="ar-hud__icon"
          onClick={onExport}
          aria-label="Download PNG"
        >
          ⤓
        </button>
      </div>

      <div className="ar-rail photo-hud__chrome">
        <button
          type="button"
          className="ar-rail__btn"
          onClick={() => zoomView(VIEW_ZOOM_STEP)}
          aria-label="Zoom in"
        >
          +
        </button>
        <span className="ar-rail__val">{Math.round(viewZoom * 100)}%</span>
        <button
          type="button"
          className="ar-rail__btn"
          onClick={() => zoomView(-VIEW_ZOOM_STEP)}
          aria-label="Zoom out"
        >
          −
        </button>

        <span className="ar-rail__sep" aria-hidden />

        <button
          type="button"
          className="ar-rail__btn"
          onClick={onAutoDetect}
          disabled={mlReady === false}
          aria-label="Auto-detect wall"
          title={mlReady === false ? "ML packages not installed on dev server" : "Auto-detect wall"}
        >
          ◫
        </button>
        <button
          type="button"
          className="ar-rail__btn"
          onClick={() => setQuad(defaultQuad())}
          aria-label="Reset corners"
        >
          ↺
        </button>
      </div>

      <div className="ar-hud__hint photo-hud__chrome">
        Drag corners to fit the wall
      </div>

      <div className="photo-hud__bottom photo-hud__chrome">
        {pickerOpen && (
          <div className="ar-overlay__tray">
            {library.map((w) => (
              <button
                key={w.id}
                className={`ar-swatch${w.id === wallpaper.id ? " is-active" : ""}`}
                style={{ backgroundImage: `url("${w.texture}")` }}
                onClick={() => {
                  select(w);
                  setPickerOpen(false);
                }}
                title={w.name}
              >
                <span className="ar-swatch__name">{w.name}</span>
              </button>
            ))}
          </div>
        )}

        {adjustOpen && (
          <div className="ar-overlay__controls">
            <label>
              Pattern size
              <input
                type="range" min={0.3} max={3} step={0.05} value={scale}
                onChange={(e) => set({ scale: Number(e.target.value) })}
              />
              <span className="ar-overlay__val">{scale.toFixed(2)}×</span>
            </label>
            <label>
              Rotate
              <input
                type="range" min={0} max={360} step={1} value={rotationDeg}
                onChange={(e) => set({ rotationDeg: Number(e.target.value) })}
              />
              <span className="ar-overlay__val">{Math.round(rotationDeg)}°</span>
            </label>
            <label>
              Lighting blend
              <input
                type="range" min={0} max={1} step={0.02} value={blend}
                onChange={(e) => set({ blend: Number(e.target.value) })}
              />
              <span className="ar-overlay__val">{Math.round(blend * 100)}%</span>
            </label>
            <label>
              Transparency
              <input
                type="range" min={0.1} max={1} step={0.02} value={opacity}
                onChange={(e) => set({ opacity: Number(e.target.value) })}
              />
              <span className="ar-overlay__val">{Math.round(opacity * 100)}%</span>
            </label>
            <div className="ar-overlay__buttons">
              <button type="button" className="btn" onClick={() => cameraRef.current?.click()}>Retake</button>
              <button type="button" className="btn" onClick={() => galleryRef.current?.click()}>Gallery</button>
              <button type="button" className="btn btn--primary" onClick={onExport}>Download PNG</button>
            </div>
          </div>
        )}

        <div className="ar-dock">
          <button
            type="button"
            className={`ar-dock__side${pickerOpen ? " is-on" : ""}`}
            onClick={togglePicker}
            aria-label="Choose wallpaper"
          >
            <span
              className="ar-dock__thumb"
              style={{ backgroundImage: `url("${wallpaper.texture}")` }}
              aria-hidden
            />
          </button>
          <button
            type="button"
            className="ar-dock__shutter"
            onClick={onAutoDetect}
            aria-label="Auto-detect wall"
          >
            <span className="ar-dock__shutter-ring" aria-hidden />
          </button>
          <button
            type="button"
            className={`ar-dock__side ar-dock__side--icon${adjustOpen ? " is-on" : ""}`}
            onClick={toggleAdjust}
            aria-label="Adjust wallpaper"
          >
            ⫶
          </button>
        </div>
      </div>

      {error && (
        <div className="photo__toast error photo-hud__chrome">
          {error}
          <button type="button" className="error__dismiss" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0], e.target)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0], e.target)}
      />
    </section>
  );
}
