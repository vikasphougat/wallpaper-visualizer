import { useCallback, useEffect, useRef, useState } from "react";
import { useSelection } from "@/stores/selection";
import { loadImage, preparePhotoBitmap, meanLuminance } from "@/lib/image";
import { defaultQuad } from "@/lib/homography";
import { createOverlayRenderer, type OverlayRenderer } from "./overlayRenderer";
import { CornerHandles } from "./CornerHandles";

const MAX_DPR = 2;

function fitPhotoToViewport(bmp: ImageBitmap): { w: number; h: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const aspect = bmp.width / bmp.height;
  let w = vw;
  let h = vw / aspect;
  if (h > vh) {
    h = vh;
    w = vh * aspect;
  }
  return { w, h };
}

export default function PhotoOverlayPage() {
  const { wallpaper, scale, rotationDeg, blend, opacity, set } = useSelection();

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
  const [controlsOpen, setControlsOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
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

    let cssW: number;
    let cssH: number;
    if (fullScreen) {
      ({ w: cssW, h: cssH } = fitPhotoToViewport(bmp));
    } else {
      cssW = stage.clientWidth;
      cssH = cssW * (bmp.height / bmp.width);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    draw();
  }, [draw, fullScreen]);

  useEffect(() => {
    draw();
  }, [draw, wallpaper]);

  useEffect(() => {
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeCanvas]);

  useEffect(() => {
    resizeCanvas();
  }, [fullScreen, resizeCanvas]);

  useEffect(() => {
    document.body.classList.toggle("photo-fullscreen", fullScreen);
    return () => document.body.classList.remove("photo-fullscreen");
  }, [fullScreen]);

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

  async function onAutoDetect() {
    if (!bitmapRef.current) return;
    setError(null);
    setBusy("Detecting wall… (first run downloads ~5 MB model)");
    try {
      const { detectWallQuad } = await import("./segmentation");
      const q = await detectWallQuad(bitmapRef.current);
      setQuad(q);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Auto-detect failed.";
      setError(msg);
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

  function toggleFullScreen() {
    setFullScreen((on) => {
      if (!on) setControlsOpen(false);
      return !on;
    });
  }

  return (
    <section className={`page page--immersive${fullScreen ? " page--fullscreen" : ""}`}>
      {!fullScreen && (
        <>
          <h2 className="page__heading">2D Photo Overlay</h2>
          <p className="page__sub page__sub--compact">
            Take or upload a wall photo, drag corners, wallpaper warps to match.
          </p>
        </>
      )}

      <div className={`photo${fullScreen ? " photo--fullscreen" : ""}`}>
        <div
          className={`photo__stage${fullScreen ? " photo__stage--fullscreen" : ""}`}
          ref={stageRef}
        >
          <canvas ref={canvasRef} className={`photo__canvas${hasPhoto ? " is-on" : ""}`} />

          {!hasPhoto && !fullScreen && (
            <div className="dropzone">
              <span className="dropzone__glyph" aria-hidden>📷</span>
              <span>Add a photo of your wall</span>
              <div className="dropzone__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => cameraRef.current?.click()}
                >
                  Take photo
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => galleryRef.current?.click()}
                >
                  From gallery
                </button>
              </div>
              <p className="dropzone__hint">On phone: tap Take photo, shoot the wall, then confirm with ✓</p>
            </div>
          )}

          {hasPhoto && <CornerHandles quad={quad} onChange={setQuad} />}
          {busy && <div className="photo__busy">{busy}</div>}

          {hasPhoto && (
            <div className="photo__floatbar">
              <button
                type="button"
                className="photo__floatbtn"
                onClick={toggleFullScreen}
              >
                {fullScreen ? "✕ Exit" : "⛶ Full screen"}
              </button>
              {fullScreen && (
                <button
                  type="button"
                  className="photo__floatbtn"
                  onClick={() => setControlsOpen((o) => !o)}
                >
                  {controlsOpen ? "▾ Hide" : "▴ Adjust"}
                </button>
              )}
            </div>
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

        {hasPhoto && !fullScreen && (
          <button
            type="button"
            className="drawer-toggle"
            onClick={() => setControlsOpen((o) => !o)}
            aria-expanded={controlsOpen}
          >
            {controlsOpen ? "▾ Hide" : "▴ Adjust"} wallpaper
          </button>
        )}

        {hasPhoto && controlsOpen && (
          <div className={`controls${fullScreen ? " controls--float" : ""}`}>
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
              <button
                type="button"
                className="btn"
                onClick={onAutoDetect}
                disabled={mlReady === false}
                title={
                  mlReady === false
                    ? "Run install.bat on your PC, then restart npm run dev"
                    : "Automatically find the wall in your photo"
                }
              >
                {mlReady === null ? "Auto-detect…" : mlReady ? "Auto-detect wall" : "Auto-detect (install ML)"}
              </button>
              <button type="button" className="btn" onClick={() => setQuad(defaultQuad())}>Reset corners</button>
              <button type="button" className="btn" onClick={() => cameraRef.current?.click()}>Retake</button>
              <button type="button" className="btn" onClick={() => galleryRef.current?.click()}>Gallery</button>
              <button type="button" className="btn btn--primary" onClick={onExport}>Download PNG</button>
            </div>
          </div>
        )}

        {error && !fullScreen && (
          <p className="error">
            {error}
            <button type="button" className="error__dismiss" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
          </p>
        )}
        {error && fullScreen && (
          <div className="photo__toast error">
            {error}
            <button type="button" className="error__dismiss" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
      </div>
    </section>
  );
}
