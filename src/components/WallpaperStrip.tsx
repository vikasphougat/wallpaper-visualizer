import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { useSelection } from "@/stores/selection";

/** Horizontal quick-picker so the chosen wallpaper persists across every tab. */
export function WallpaperStrip() {
  const { library } = useWallpaperLibrary();
  const wallpaper = useSelection((s) => s.wallpaper);
  const select = useSelection((s) => s.select);

  return (
    <div className="strip" role="listbox" aria-label="Choose wallpaper">
      {library.map((w) => {
        const active = w.id === wallpaper.id;
        return (
          <button
            key={w.id}
            role="option"
            aria-selected={active}
            className={`strip__swatch${active ? " is-active" : ""}`}
            style={{ backgroundImage: `url("${w.texture}")`, outlineColor: w.accent }}
            onClick={() => select(w)}
            title={w.name}
          >
            <span className="strip__name">{w.name}</span>
          </button>
        );
      })}
    </div>
  );
}
