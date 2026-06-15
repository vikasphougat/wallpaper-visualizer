import { useCallback, useEffect, useRef, useState } from "react";
import { useSelection } from "@/stores/selection";
import {
  RoomScene,
  type FloorStyle,
  type LightingPreset,
  type RoomSizePreset,
  type WallId,
} from "./roomScene";

const ALL_WALLS: { id: WallId; label: string }[] = [
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

const LIGHTING: LightingPreset[] = ["apartment", "daylight", "evening"];
const ROOM_SIZES: { id: RoomSizePreset; label: string }[] = [
  { id: "cozy", label: "Cozy" },
  { id: "standard", label: "Standard" },
  { id: "wide", label: "Wide" },
];
const FLOORS: { id: FloorStyle; label: string }[] = [
  { id: "wood", label: "Wood" },
  { id: "tile", label: "Tile" },
  { id: "carpet", label: "Carpet" },
];

export default function RoomPage() {
  const wallpaper = useSelection((s) => s.wallpaper);
  const { scale, rotationDeg, set } = useSelection();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RoomScene | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);

  const [papered, setPapered] = useState<WallId[]>(["back"]);
  const [lighting, setLighting] = useState<LightingPreset>("apartment");
  const [roomSize, setRoomSize] = useState<RoomSizePreset>("standard");
  const [floorStyle, setFloorStyle] = useState<FloorStyle>("wood");
  const [furniture, setFurniture] = useState(false);
  const [shadows, setShadows] = useState(1);
  const [paint, setPaint] = useState("#ece7df");

  const repeatFromScale = useCallback((s: number): [number, number] => {
    const base = 4 / Math.max(0.3, s);
    return [base, base * 0.7];
  }, []);

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
    scene.setPaperedWalls(papered);
    scene
      .setWallpaper(wallpaper.texture)
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : "Texture load failed"));

    const ro = new ResizeObserver(() => scene.resize());
    if (stageRef.current) ro.observe(stageRef.current);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    sceneRef.current?.setRoomSizePreset(roomSize);
  }, [roomSize]);

  useEffect(() => {
    sceneRef.current?.setFloorStyle(floorStyle);
  }, [floorStyle]);

  useEffect(() => {
    sceneRef.current?.setFurnitureVisible(furniture);
  }, [furniture]);

  useEffect(() => {
    sceneRef.current?.setShadowIntensity(shadows);
  }, [shadows]);

  function toggleWall(id: WallId) {
    setPapered((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  }

  function featureWall(id: WallId) {
    setPapered([id]);
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
    <section className="page page--immersive">
      <h2 className="page__heading">3D Room Preview</h2>
      <p className="page__sub page__sub--compact">
        Orbit · pinch zoom · <strong>{wallpaper.name}</strong>
      </p>

      <div className="room">
        <figure className="room__stage room__stage--tall" ref={stageRef}>
          <canvas ref={canvasRef} className="room__canvas" aria-label="3D room preview with wallpaper" />
          {!ready && !error && <div className="room__busy">Building room…</div>}
          {error && <div className="room__busy room__busy--err">{error}</div>}
        </figure>

        <button
          type="button"
          className="drawer-toggle"
          onClick={() => setControlsOpen((o) => !o)}
          aria-expanded={controlsOpen}
        >
          {controlsOpen ? "▾ Hide" : "▴ Room"} options
        </button>

        {controlsOpen && (
          <div className="controls">
            <div className="controls__group">
              <span className="controls__legend">Wallpaper on</span>
              <div className="chips">
                {ALL_WALLS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`chip${papered.includes(w.id) ? " is-on" : ""}`}
                    onClick={() => toggleWall(w.id)}
                    aria-pressed={papered.includes(w.id)}
                  >
                    {w.label}
                  </button>
                ))}
                <button type="button" className="chip" onClick={() => featureWall("back")}>Feature back</button>
                <button type="button" className="chip" onClick={() => setPapered(["back", "left", "right"])}>All walls</button>
              </div>
            </div>

            <div className="controls__group">
              <span className="controls__legend">Room size</span>
              <div className="chips">
                {ROOM_SIZES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`chip${roomSize === r.id ? " is-on" : ""}`}
                    onClick={() => setRoomSize(r.id)}
                    aria-pressed={roomSize === r.id}
                  >
                    {r.label}
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
                    type="button"
                    className={`chip${lighting === l ? " is-on" : ""}`}
                    onClick={() => setLighting(l)}
                    aria-pressed={lighting === l}
                  >
                    {l[0].toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="controls__group">
              <span className="controls__legend">Floor</span>
              <div className="chips">
                {FLOORS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`chip${floorStyle === f.id ? " is-on" : ""}`}
                    onClick={() => setFloorStyle(f.id)}
                    aria-pressed={floorStyle === f.id}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="controls__row">
              <label>
                Shadows
                <input
                  type="range" min={0} max={1} step={0.05} value={shadows}
                  onChange={(e) => setShadows(Number(e.target.value))}
                />
              </label>
              <label className="controls__check">
                <input
                  type="checkbox"
                  checked={furniture}
                  onChange={(e) => setFurniture(e.target.checked)}
                />
                Show furniture
              </label>
            </div>

            <div className="controls__actions">
              <label className="btn btn--swatch">
                Wall paint
                <input type="color" value={paint} onChange={(e) => setPaint(e.target.value)} />
              </label>
              <button type="button" className="btn" onClick={() => sceneRef.current?.resetView()}>Reset view</button>
              <button type="button" className="btn btn--primary" onClick={onSnapshot}>Download PNG</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
