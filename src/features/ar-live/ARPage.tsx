import { useEffect, useMemo, useRef, useState } from "react";
import { useSelection } from "@/stores/selection";
import { useXRSupport } from "@/hooks/useXRSupport";
import { CATALOG } from "@/data/catalog";
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
  const xr = useXRSupport();

  const sessionRef = useRef<ARSession | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [reticle, setReticle] = useState(false);
  const [occlusion, setOcclusion] = useState(false);
  const [wallFit, setWallFit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const [arScale, setArScale] = useState(1);
  const [arRotation, setArRotation] = useState(0);
  const [arOpacity, setArOpacity] = useState(1);

  const [custom, setCustom] = useState<Wallpaper[]>(() => readJSON<Wallpaper[]>(CUSTOM_KEY, []));
  const [currentId, setCurrentId] = useState(wallpaper.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [coverMode, setCoverMode] = useState(false);
  const [savedCount, setSavedCount] = useState(() => readJSON<SerializedPatch[]>(LAYOUT_KEY, []).length);
  const [handles, setHandles] = useState<HandleOverlay | null>(null);

  const library = useMemo<Wallpaper[]>(() => [...CATALOG, ...custom], [custom]);
  const current = useMemo(
    () => library.find((w) => w.id === currentId) ?? wallpaper,
    [library, currentId, wallpaper],
  );

  useEffect(() => () => void sessionRef.current?.end(), []);

  // Persist the custom (uploaded) library so swatches survive a reload.
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    } catch {
      /* quota — ignore */
    }
  }, [custom]);

  // Touching overlay controls must not also fire a WebXR `select`.
  useEffect(() => {
    const root = overlayRef.current;
    if (!root) return;
    const block = (e: Event) => e.preventDefault();
    root.addEventListener("beforexrselect", block);
    return () => root.removeEventListener("beforexrselect", block);
  }, []);

  async function startAR() {
    if (!overlayRef.current || !gestureRef.current) return;
    setError(null);
    setPhase("starting");
    const session = new ARSession();
    sessionRef.current = session;
    session.setCoverMode(coverMode);
    await session.start({
      overlayRoot: overlayRef.current,
      gestureRoot: gestureRef.current,
      textureUrl: current.texture,
      wallpaperId: current.id,
      tileable: current.tileable !== false,
      onReticle: (v) => setReticle(v),
      onDepth: (v) => setOcclusion(v),
      onWallFit: (v) => setWallFit(v),
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
          /* quota — ignore */
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

  function pickWallpaper(w: Wallpaper) {
    setCurrentId(w.id);
    sessionRef.current?.setCurrentWallpaper(w.texture, w.id, w.tileable !== false);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const w: Wallpaper = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "My wallpaper",
        texture: reader.result as string, // data URL → persists across reloads
        physicalRepeatCm: [53, 53],
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

  // Only one tray open at a time so the camera view stays clear.
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
    setArScale(v);
    sessionRef.current?.setScale(v);
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

  const inSession = phase === "scanning" || phase === "placed" || phase === "starting";

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
            </p>

            {xr === "supported" && (
              <button className="btn btn--primary" onClick={startAR}>Start AR</button>
            )}

            {xr === "unsupported" && (
              <p className="hint">
                Live AR needs <strong>Android Chrome with ARCore</strong> over <strong>HTTPS</strong>.
                A plain <code>http://LAN-IP</code> URL is not a secure context, so AR is blocked even
                on capable phones — use an HTTPS tunnel or <code>npm i -D @vitejs/plugin-basic-ssl</code>
                (see README). iOS Safari has no WebXR; that needs the native ViroReact build.
                Meanwhile, try the <strong>Photo</strong> or <strong>3D Room</strong> tabs.
              </p>
            )}

            {error && <p className="error">{error}</p>}
            <ul>
              <li>Tap an empty area to place wallpaper on the detected wall</li>
              <li>Each wall can use a <strong>different wallpaper</strong> — pick from the in-AR tray</li>
              <li><strong>Drag corners/edges</strong> to stretch the wallpaper to fit the wall</li>
              <li><strong>Drag center</strong> to move · <strong>pinch</strong> to resize · <strong>twist</strong> to rotate</li>
              <li>Tap a placed patch to select it, then <strong>Delete</strong> or fine-tune with sliders</li>
              <li>“Cover wall” fits the wallpaper <strong>edge-to-edge</strong> on detected walls</li>
              <li>Your layout is saved — use <strong>Restore</strong> next session</li>
            </ul>
          </div>
        </div>
      )}

      <div ref={overlayRef} className={`ar-overlay${inSession ? " is-on" : ""}`}>
        <div ref={gestureRef} className="ar-overlay__gesture" />

        {/* Corner (large) + edge (small) drag handles for the selected patch */}
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

        <div className="ar-overlay__top">
          <button className="ar-overlay__exit" onClick={() => sessionRef.current?.end()}>✕ Exit</button>
          <span className="ar-overlay__chip">
            {current.name}
            {count > 0 && <span className="ar-overlay__badge"> · {count} placed</span>}
            {wallFit && coverMode && <span className="ar-overlay__badge" title="Edge-to-edge wall fit"> · edge-fit</span>}
            {occlusion && <span className="ar-overlay__badge" title="Depth occlusion active"> · occlusion</span>}
          </span>
        </div>

        <div className="ar-overlay__hint">
          {phase === "starting" && "Starting AR…"}
          {phase === "scanning" &&
            (reticle
              ? coverMode
                ? "Tap a wall to cover it edge-to-edge · pinch to fine-tune"
                : "Tap to place · drag to move · pinch to resize · open Adjust for sliders"
              : "Aim at a textured spot and move slowly — or use “Place here”")}
          {phase === "placed" && "Drag corners/edges to fit the wall · pinch to rotate/scale · open trays below"}
        </div>

        <div className="ar-overlay__bottom">
          <div className="ar-overlay__pickbar">
            <button
              className={`ar-overlay__arrow${pickerOpen ? " is-on" : ""}`}
              onClick={toggleWallpaperTray}
              aria-expanded={pickerOpen}
            >
              {pickerOpen ? "▾" : "▴"} Wallpaper
            </button>
            <button
              className={`ar-overlay__arrow${adjustOpen ? " is-on" : ""}`}
              onClick={toggleAdjustTray}
              aria-expanded={adjustOpen}
            >
              {adjustOpen ? "▾" : "▴"} Adjust
            </button>
            <button
              className={`ar-overlay__toggle${coverMode ? " is-on" : ""}`}
              onClick={toggleCover}
              title="Fit / tile a sheet across the whole wall (edge-to-edge where supported)"
            >
              {coverMode ? "✓ " : ""}Cover wall
            </button>
            {savedCount > 0 && (
              <button className="ar-overlay__toggle" onClick={restoreLayout} title="Re-place your saved layout">
                ↺ Restore ({savedCount})
              </button>
            )}
          </div>

          {pickerOpen && (
            <div className="ar-overlay__tray">
              {library.map((w) => (
                <button
                  key={w.id}
                  className={`ar-swatch${w.id === currentId ? " is-active" : ""}`}
                  style={{ backgroundImage: `url("${w.texture}")` }}
                  onClick={() => pickWallpaper(w)}
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
                <input
                  type="range" min={0.3} max={6} step={0.05} value={arScale}
                  onChange={(e) => adjustScale(Number(e.target.value))}
                />
                <span className="ar-overlay__val">{arScale.toFixed(2)}×</span>
              </label>
              <label>
                Rotate
                <input
                  type="range" min={0} max={360} step={1} value={arRotation}
                  onChange={(e) => adjustRotation(Number(e.target.value))}
                />
                <span className="ar-overlay__val">{Math.round(arRotation)}°</span>
              </label>
              <label>
                Transparency
                <input
                  type="range" min={0} max={0.8} step={0.05} value={1 - arOpacity}
                  onChange={(e) => adjustOpacity(1 - Number(e.target.value))}
                />
                <span className="ar-overlay__val">{Math.round((1 - arOpacity) * 100)}%</span>
              </label>
              <div className="ar-overlay__buttons">
                <button className="btn btn--primary" onClick={() => sessionRef.current?.placeInFront()}>
                  Place here
                </button>
                <button className="btn btn--danger" onClick={() => sessionRef.current?.removeSelected()}>
                  Delete
                </button>
                <button className="btn" onClick={() => sessionRef.current?.removeLast()}>Undo</button>
                <button className="btn" onClick={() => sessionRef.current?.clearPlaced()}>Clear</button>
                <button className="btn" onClick={snapshot}>Snapshot</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
