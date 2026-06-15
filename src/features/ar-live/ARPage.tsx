import { useEffect, useMemo, useRef, useState } from "react";
import { useSelection } from "@/stores/selection";
import { useXRSupport } from "@/hooks/useXRSupport";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import type { Wallpaper } from "@/types";
import { ARSession, type HandleOverlay, type SerializedPatch } from "./arSession";

type Phase = "idle" | "starting" | "scanning" | "placed";

const LAYOUT_KEY = "wallviz-ar-layout";
const CUSTOM_KEY = "wallviz-ar-custom";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function ARPage() {
  const { wallpaper } = useSelection();
  const { library, syncing } = useWallpaperLibrary();
  const xr = useXRSupport();

  const sessionRef = useRef<ARSession | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [reticle, setReticle] = useState(false);
  const [occlusion, setOcclusion] = useState(false);
  const [wallFit, setWallFit] = useState(false);
  const [anchorsAvailable, setAnchorsAvailable] = useState(false);
  const [useAnchors, setUseAnchors] = useState(true);
  const [viewZoom, setViewZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const [arScale, setArScale] = useState(1);
  const [arRotation, setArRotation] = useState(0);
  const [arOpacity, setArOpacity] = useState(1);

  const [custom, setCustom] = useState<Wallpaper[]>(() => readJSON<Wallpaper[]>(CUSTOM_KEY, []));
  const [currentId, setCurrentId] = useState(wallpaper.id);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [pickTarget, setPickTarget] = useState<"a" | "b">("a");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [coverMode, setCoverMode] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [savedCount, setSavedCount] = useState(() => readJSON<SerializedPatch[]>(LAYOUT_KEY, []).length);
  const [handles, setHandles] = useState<HandleOverlay | null>(null);

  const fullLibrary = useMemo<Wallpaper[]>(() => [...library, ...custom], [library, custom]);
  const current = useMemo(
    () => fullLibrary.find((w) => w.id === currentId) ?? wallpaper,
    [fullLibrary, currentId, wallpaper],
  );
  const compareWall = useMemo(
    () => (compareId ? fullLibrary.find((w) => w.id === compareId) : null),
    [fullLibrary, compareId],
  );

  useEffect(() => () => void sessionRef.current?.end(), []);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    } catch {
      /* quota */
    }
  }, [custom]);

  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return;
    const block = (e: Event) => e.preventDefault();
    root.addEventListener("beforexrselect", block);
    return () => root.removeEventListener("beforexrselect", block);
  }, []);

  function syncCompareToSession() {
    const b = compareWall ?? fullLibrary.find((w) => w.id !== current.id) ?? current;
    sessionRef.current?.setCompareMode(compareMode, {
      url: b.texture,
      id: b.id,
      tileable: b.tileable !== false,
      physicalRepeatCm: b.physicalRepeatCm,
    });
  }

  async function startAR() {
    if (!overlayRef.current || !gestureRef.current) return;
    setError(null);
    setPhase("starting");
    const session = new ARSession();
    sessionRef.current = session;
    session.setCoverMode(coverMode);
    session.setUseAnchors(useAnchors);
    syncCompareToSession();
    await session.start({
      overlayRoot: overlayRef.current,
      gestureRoot: gestureRef.current,
      textureUrl: current.texture,
      wallpaperId: current.id,
      tileable: current.tileable !== false,
      physicalRepeatCm: current.physicalRepeatCm,
      onReticle: (v) => setReticle(v),
      onDepth: (v) => setOcclusion(v),
      onWallFit: (v) => setWallFit(v),
      onAnchorsAvailable: (v) => {
        setAnchorsAvailable(v);
        if (v) {
          setUseAnchors(true);
          sessionRef.current?.setUseAnchors(true);
        }
      },
      onViewZoom: setViewZoom,
      onCountChange: (n) => setCount(n),
      onPlaced: () => setPhase("placed"),
      onSelectPatch: (info) => {
        if (!info) return;
        setArScale(info.scale);
        setArRotation(info.rotationDeg);
        setArOpacity(info.opacity);
        if (info.wallpaperId) setCurrentId(info.wallpaperId);
      },
      onLayoutChange: (patches) => {
        try {
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(patches));
        } catch {
          /* quota */
        }
        setSavedCount(patches.length);
      },
      onHandleOverlay: setHandles,
      onError: (m) => {
        setError(m);
        setPhase("idle");
      },
      onEnd: () => {
        setPhase("idle");
        setReticle(false);
        setOcclusion(false);
        setWallFit(false);
        setAnchorsAvailable(false);
        setUseAnchors(true);
        setViewZoom(1);
        setCount(0);
        setHandles(null);
        sessionRef.current = null;
      },
    });
    setPhase((p) => (p === "starting" ? "scanning" : p));
  }

  function restoreLayout() {
    const saved = readJSON<SerializedPatch[]>(LAYOUT_KEY, []);
    if (!saved.length || !sessionRef.current) return;
    sessionRef.current.clearPlaced();
    void sessionRef.current.restore(saved);
  }

  function pickWallpaper(w: Wallpaper, forCompare = false) {
    if (forCompare) {
      setCompareId(w.id);
      if (compareMode) {
        sessionRef.current?.setCompareMode(true, {
          url: w.texture,
          id: w.id,
          tileable: w.tileable !== false,
          physicalRepeatCm: w.physicalRepeatCm,
        });
      }
      return;
    }
    setCurrentId(w.id);
    sessionRef.current?.setCurrentWallpaper(
      w.texture,
      w.id,
      w.tileable !== false,
      w.physicalRepeatCm,
    );
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const w: Wallpaper = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "My wallpaper",
        texture: reader.result as string,
        physicalRepeatCm: [104, 104],
        accent: "#6ea8fe",
        tileable: false,
        source: "Uploaded",
      };
      setCustom((c) => [...c, w]);
      pickWallpaper(w);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function toggleCover() {
    const next = !coverMode;
    setCoverMode(next);
    sessionRef.current?.setCoverMode(next);
  }

  function toggleAnchors() {
    const next = !useAnchors;
    setUseAnchors(next);
    sessionRef.current?.setUseAnchors(next);
  }

  function toggleCompare() {
    const next = !compareMode;
    setCompareMode(next);
    if (next && !compareId) {
      const alt = fullLibrary.find((w) => w.id !== current.id);
      if (alt) setCompareId(alt.id);
    }
    sessionRef.current?.setCompareMode(next, compareWall ? {
      url: compareWall.texture,
      id: compareWall.id,
      tileable: compareWall.tileable !== false,
      physicalRepeatCm: compareWall.physicalRepeatCm,
    } : undefined);
  }

  function toggleWallpaperTray() {
    setPickerOpen((o) => {
      const next = !o;
      if (next) setAdjustOpen(false);
      return next;
    });
  }
  function toggleAdjustTray() {
    setAdjustOpen((o) => {
      const next = !o;
      if (next) setPickerOpen(false);
      return next;
    });
  }

  function adjustScale(v: number) {
    const clamped = Math.min(6, Math.max(0.3, Number(v.toFixed(2))));
    setArScale(clamped);
    sessionRef.current?.setScale(clamped);
  }

  function zoomCamera(delta: number) {
    sessionRef.current?.adjustViewZoom(delta);
  }
  function adjustRotation(v: number) {
    setArRotation(v);
    sessionRef.current?.setRotation(v);
  }
  function adjustOpacity(v: number) {
    setArOpacity(v);
    sessionRef.current?.setOpacity(v);
  }

  function snapshot() {
    const url = sessionRef.current?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `ar-${current.id}.png`;
    a.click();
  }

  async function exportBeforeAfter() {
    const url = await sessionRef.current?.exportBeforeAfter();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallpaper-before-after-${current.id}.png`;
    a.click();
  }

  const inSession = phase === "scanning" || phase === "placed" || phase === "starting";

  useEffect(() => {
    document.body.classList.toggle("ar-immersive", inSession);
    return () => document.body.classList.remove("ar-immersive");
  }, [inSession]);

  return (
    <section className="page">
      <h2 className="page__heading">Live AR Overlay</h2>
      <p className="page__sub">Point your camera at a wall and place the wallpaper in real space.</p>

      {!inSession && (
        <div className="placeholder">
          <div className="placeholder__hero" style={{ backgroundImage: `url("${current.texture}")` }}>
            <span className="placeholder__cube" aria-hidden>📷</span>
          </div>
          <div className="placeholder__body">
            <p>
              WebXR AR on this device:{" "}
              <strong className={xr === "supported" ? "ok" : xr === "checking" ? "" : "warn"}>
                {xr === "checking" ? "checking…" : xr === "supported" ? "available" : "not available"}
              </strong>
              {syncing && <span className="hint"> · syncing Marshalls catalog…</span>}
            </p>

            {xr === "supported" && (
              <button className="btn btn--primary" onClick={startAR}>Start AR</button>
            )}

            {xr === "unsupported" && (
              <p className="hint">
                Live AR needs <strong>Android Chrome with ARCore</strong> over <strong>HTTPS</strong>.
                iOS needs the native app in <code>mobile/</code> (ARKit). Meanwhile try <strong>Photo</strong> or <strong>3D Room</strong>.
              </p>
            )}

            {error && <p className="error">{error}</p>}
            <ul>
              <li>Tap a wall to place wallpaper — adjust corners and edges after placing</li>
              <li><strong>Lock wall</strong> (optional) — keeps wallpaper fixed to the wall when you walk around</li>
              <li><strong>Fill wall</strong> — one tap sizes wallpaper edge-to-edge on detected walls</li>
              <li><strong>Compare</strong> — place two designs side-by-side on the same wall</li>
              <li><strong>Before/After export</strong> — shareable customer image</li>
              <li>Physical scale uses real roll width (Marshalls 1.04 m)</li>
              <li>Marshalls catalog syncs automatically from their Shopify store</li>
            </ul>
          </div>
        </div>
      )}

      <div ref={overlayRef} className={`ar-overlay${inSession ? " is-on" : ""}`}>
        <div ref={gestureRef} className="ar-overlay__gesture" />

        {handles && inSession && (
          <div className="ar-handles" aria-hidden>
            {handles.corners.map((pt, i) => (
              <div key={`c${i}`} className="ar-handle ar-handle--corner" style={{ left: pt.x, top: pt.y }} />
            ))}
            {handles.edges.map((pt, i) => (
              <div key={`e${i}`} className="ar-handle ar-handle--edge" style={{ left: pt.x, top: pt.y }} />
            ))}
          </div>
        )}

        <div className="ar-hud__top">
          <button
            className="ar-hud__icon ar-hud__icon--exit"
            onClick={() => sessionRef.current?.end()}
            aria-label="Exit AR"
            title="Exit"
          >
            ✕
          </button>
          <span className="ar-hud__chip">
            {compareMode ? `${current.name} vs ${compareWall?.name ?? "…"}` : current.name}
            {count > 0 && <span className="ar-hud__badge"> · {count}</span>}
            {useAnchors && anchorsAvailable && (
              <span className="ar-hud__badge" title="XR anchors active"> · anchored</span>
            )}
            {wallFit && coverMode && <span className="ar-hud__badge" title="Fill wall"> ▦</span>}
          </span>
          <button
            className="ar-hud__icon"
            onClick={snapshot}
            aria-label="Snapshot"
            title="Snapshot"
          >
            ⤓
          </button>
        </div>

        {/* Right vertical rail: zoom + minimal toggles (Snapchat-style) */}
        <div className="ar-rail">
          <button
            className="ar-rail__btn"
            onClick={() => zoomCamera(0.12)}
            aria-label="Zoom in"
            title="Zoom camera in"
          >
            +
          </button>
          <span className="ar-rail__val">{Math.round(viewZoom * 100)}%</span>
          <button
            className="ar-rail__btn"
            onClick={() => zoomCamera(-0.12)}
            aria-label="Zoom out"
            title="Zoom camera out"
          >
            −
          </button>

          <span className="ar-rail__sep" aria-hidden />

          <button
            className={`ar-rail__btn ar-rail__btn--toggle${coverMode ? " is-on" : ""}`}
            onClick={toggleCover}
            aria-label="Fill wall"
            aria-pressed={coverMode}
            title="Fill wall"
          >
            ▦
          </button>
          <button
            className={`ar-rail__btn ar-rail__btn--toggle${compareMode ? " is-on" : ""}`}
            onClick={toggleCompare}
            aria-label="Compare two wallpapers"
            aria-pressed={compareMode}
            title="Compare"
          >
            ◧
          </button>
          {anchorsAvailable && (
            <button
              className={`ar-rail__btn ar-rail__btn--toggle${useAnchors ? " is-on" : ""}`}
              onClick={toggleAnchors}
              aria-label="Lock wallpaper to wall"
              aria-pressed={useAnchors}
              title="Lock to wall"
            >
              {useAnchors ? "🔒" : "🔓"}
            </button>
          )}
          {savedCount > 0 && (
            <button
              className="ar-rail__btn"
              onClick={restoreLayout}
              aria-label="Restore saved layout"
              title={`Restore ${savedCount} saved`}
            >
              ↺
            </button>
          )}
        </div>

        <div className="ar-hud__hint">
          {phase === "starting" && "Starting AR…"}
          {phase === "scanning" &&
            (reticle
              ? compareMode
                ? "Tap wall to compare side-by-side"
                : coverMode
                  ? "Tap wall to auto-fill edge-to-edge"
                  : "Tap to place · drag corners to fit"
              : "Aim at the wall and move slowly")}
        </div>

        <div className="ar-overlay__bottom">
          {pickerOpen && (
            <div className="ar-overlay__tray">
              {compareMode && (
                <div className="ar-overlay__tray-hint ar-overlay__ab">
                  <button
                    className={`ar-overlay__toggle${pickTarget === "a" ? " is-on" : ""}`}
                    onClick={() => setPickTarget("a")}
                  >A · left</button>
                  <button
                    className={`ar-overlay__toggle${pickTarget === "b" ? " is-on" : ""}`}
                    onClick={() => setPickTarget("b")}
                  >B · right</button>
                </div>
              )}
              {fullLibrary.map((w) => (
                <button
                  key={w.id}
                  className={`ar-swatch${
                    w.id === currentId ? " is-active" : w.id === compareId ? " is-compare" : ""
                  }`}
                  style={{ backgroundImage: `url("${w.texture}")` }}
                  onClick={() => pickWallpaper(w, compareMode && pickTarget === "b")}
                  title={w.source ? `${w.name} — ${w.source}` : w.name}
                >
                  <span className="ar-swatch__name">{w.name}</span>
                </button>
              ))}
              <button className="ar-swatch ar-swatch--add" onClick={() => fileRef.current?.click()}>
                <span>＋</span>
                <span className="ar-swatch__name">Add</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
            </div>
          )}

          {adjustOpen && (
            <div className="ar-overlay__controls">
              <label>
                Size
                <input type="range" min={0.3} max={6} step={0.05} value={arScale}
                  onChange={(e) => adjustScale(Number(e.target.value))} />
                <span className="ar-overlay__val">{arScale.toFixed(2)}×</span>
              </label>
              <label>
                Rotate
                <input type="range" min={0} max={360} step={1} value={arRotation}
                  onChange={(e) => adjustRotation(Number(e.target.value))} />
                <span className="ar-overlay__val">{Math.round(arRotation)}°</span>
              </label>
              <label>
                Transparency
                <input type="range" min={0} max={0.8} step={0.05} value={1 - arOpacity}
                  onChange={(e) => adjustOpacity(1 - Number(e.target.value))} />
                <span className="ar-overlay__val">{Math.round((1 - arOpacity) * 100)}%</span>
              </label>
              <div className="ar-overlay__buttons">
                <button className="btn btn--danger" onClick={() => sessionRef.current?.removeSelected()}>
                  Delete
                </button>
                <button className="btn" onClick={() => sessionRef.current?.removeLast()}>Undo</button>
                <button className="btn" onClick={() => sessionRef.current?.clearPlaced()}>Clear</button>
                <button className="btn" onClick={exportBeforeAfter}>Before/After</button>
              </div>
            </div>
          )}

          {/* Minimal Snapchat-style dock: wallpaper · place shutter · adjust */}
          <div className="ar-dock">
            <button
              className={`ar-dock__side${pickerOpen ? " is-on" : ""}`}
              onClick={toggleWallpaperTray}
              aria-label="Choose wallpaper"
              title="Wallpaper"
            >
              <span
                className="ar-dock__thumb"
                style={{ backgroundImage: `url("${current.texture}")` }}
                aria-hidden
              />
            </button>

            <button
              className="ar-dock__shutter"
              onClick={() => sessionRef.current?.placeInFront()}
              aria-label="Place wallpaper here"
              title="Place here"
            >
              <span className="ar-dock__shutter-ring" aria-hidden />
            </button>

            <button
              className={`ar-dock__side ar-dock__side--icon${adjustOpen ? " is-on" : ""}`}
              onClick={toggleAdjustTray}
              aria-label="Adjust wallpaper"
              title="Adjust"
            >
              ⫶
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
