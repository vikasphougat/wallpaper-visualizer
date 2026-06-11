import { useCallback, useEffect, useRef, useState } from "react";
import { useSelection } from "@/stores/selection";
import { RoomScene, type LightingPreset, type WallId } from "./roomScene";

const ALL_WALLS: { id: WallId; label: string }[] = [
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

const LIGHTING: LightingPreset[] = ["apartment", "daylight", "evening"];

export default function RoomPage() {
  const wallpaper = useSelection((s) => s.wallpaper);
  const { scale, rotationDeg, set } = useSelection();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RoomScene | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [papered, setPapered] = useState<WallId[]>(["back", "left", "right"]);
  const [lighting, setLighting] = useState<LightingPreset>("apartment");
  const [paint, setPaint] = useState("#ece7df");

  // Convert the shared "scale" (pattern size) into Three.js UV repeats.
  // Bigger scale = larger motif = fewer repeats.
  const repeatFromScale = useCallback((s: number): [number, number] => {
    const base = 4 / Math.max(0.3, s);
    return [base, base * 0.7];
  }, []);

  // Initialise the scene once the canvas is mounted.
  useEffect(() => {
    if (!canvasRef.current) return;
    let scene: RoomScene;
    try {
      scene = new RoomScene(canvasRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "WebGL is not available on this device.");
      return;
    }
    sceneRef.current = scene;
    const [rx, ry] = repeatFromScale(scale);
    scene.setRepeat(rx, ry);
    scene.setRotation(rotationDeg);
    scene.setPaintColor(paint);
    scene
      .setWallpaper(wallpaper.texture)
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : "Texture load failed"));

    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to wallpaper changes.
  useEffect(() => {
    sceneRef.current?.setWallpaper(wallpaper.texture).catch(() => {});
  }, [wallpaper.texture]);

  useEffect(() => {
    const [rx, ry] = repeatFromScale(scale);
    sceneRef.current?.setRepeat(rx, ry);
  }, [scale, repeatFromScale]);

  useEffect(() => {
    sceneRef.current?.setRotation(rotationDeg);
  }, [rotationDeg]);

  useEffect(() => {
    sceneRef.current?.setPaperedWalls(papered);
  }, [papered]);

  useEffect(() => {
    sceneRef.current?.applyLighting(lighting);
  }, [lighting]);

  useEffect(() => {
    sceneRef.current?.setPaintColor(paint);
  }, [paint]);

  function toggleWall(id: WallId) {
    setPapered((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  }

  function onSnapshot() {
    const url = sceneRef.current?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `room-${wallpaper.id}.png`;
    a.click();
  }

  return (
    <section className="page">
      <h2 className="page__heading">3D Room Preview</h2>
      <p className="page__sub">
        Drag to orbit, scroll or pinch to zoom. Apply <strong>{wallpaper.name}</strong> to any walls
        and view it under different lighting.
      </p>

      <div className="room">
        <figure className="room__stage">
          <canvas ref={canvasRef} className="room__canvas" aria-label="3D room preview with wallpaper" />
          {!ready && !error && <div className="room__busy">Building room…</div>}
          {error && <div className="room__busy room__busy--err">{error}</div>}
        </figure>

        <div className="controls">
          <div className="controls__group">
            <span className="controls__legend">Apply wallpaper to</span>
            <div className="chips">
              {ALL_WALLS.map((w) => (
                <button
                  key={w.id}
                  className={`chip${papered.includes(w.id) ? " is-on" : ""}`}
                  onClick={() => toggleWall(w.id)}
                  aria-pressed={papered.includes(w.id)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

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

          <div className="controls__group">
            <span className="controls__legend">Lighting</span>
            <div className="chips">
              {LIGHTING.map((l) => (
                <button
                  key={l}
                  className={`chip${lighting === l ? " is-on" : ""}`}
                  onClick={() => setLighting(l)}
                  aria-pressed={lighting === l}
                >
                  {l[0].toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="controls__actions">
            <label className="btn btn--swatch">
              Wall paint
              <input type="color" value={paint} onChange={(e) => setPaint(e.target.value)} />
            </label>
            <button className="btn" onClick={() => sceneRef.current?.resetView()}>Reset view</button>
            <button className="btn btn--primary" onClick={onSnapshot}>Download PNG</button>
          </div>
        </div>
      </div>
    </section>
  );
}
