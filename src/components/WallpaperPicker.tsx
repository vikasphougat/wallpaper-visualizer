import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useWallpaperLibrary } from "@/hooks/useWallpaperLibrary";
import { useSelection } from "@/stores/selection";

/** Bottom floating button + horizontal slider tray — saves vertical space vs a top strip. */
export function WallpaperPicker() {
  const { library } = useWallpaperLibrary();
  const wallpaper = useSelection((s) => s.wallpaper);
  const select = useSelection((s) => s.select);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // AR and Photo use in-session wallpaper trays.
  if (pathname === "/ar" || pathname === "/photo") return null;

  return (
    <div className={`picker${open ? " is-open" : ""}`}>
      {open && (
        <div
          className="picker__backdrop"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <div className="picker__panel">
        {open && (
          <div className="picker__tray" role="listbox" aria-label="Choose wallpaper">
            {library.map((w) => {
              const active = w.id === wallpaper.id;
              return (
                <button
                  key={w.id}
                  role="option"
                  aria-selected={active}
                  className={`picker__swatch${active ? " is-active" : ""}`}
                  style={{ backgroundImage: `url("${w.texture}")`, outlineColor: w.accent }}
                  onClick={() => {
                    select(w);
                    setOpen(false);
                  }}
                  title={w.name}
                >
                  <span className="picker__name">{w.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="picker__toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span
            className="picker__current"
            style={{ backgroundImage: `url("${wallpaper.texture}")` }}
            aria-hidden
          />
          <span className="picker__label">
            {open ? "Close" : wallpaper.name}
          </span>
          <span className="picker__chev" aria-hidden>{open ? "▾" : "▴"}</span>
        </button>
      </div>
    </div>
  );
}
