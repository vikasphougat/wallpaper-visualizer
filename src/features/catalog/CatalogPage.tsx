import { Link } from "react-router-dom";
import { CATALOG } from "@/data/catalog";
import { useSelection } from "@/stores/selection";

export default function CatalogPage() {
  const wallpaper = useSelection((s) => s.wallpaper);
  const select = useSelection((s) => s.select);

  return (
    <section className="page">
      <h2 className="page__heading">Wallpaper catalog</h2>
      <p className="page__sub">Pick a design. It stays selected across the Photo, 3D, and AR tabs.</p>

      <div className="catalog">
        {CATALOG.map((w) => {
          const active = w.id === wallpaper.id;
          return (
            <button
              key={w.id}
              className={`catalog__card${active ? " is-active" : ""}`}
              onClick={() => select(w)}
            >
              <span
                className="catalog__preview"
                style={{ backgroundImage: `url("${w.texture}")`, backgroundColor: w.accent }}
              />
              <span className="catalog__meta">
                <strong>{w.name}</strong>
                <small>Roll {w.physicalRepeatCm[0]}cm · repeat {w.physicalRepeatCm[1]}cm</small>
              </span>
              {active && <span className="catalog__check" aria-hidden>✓</span>}
            </button>
          );
        })}
      </div>

      <Link className="btn btn--primary" to="/photo">
        Try the selected wallpaper on a photo →
      </Link>
    </section>
  );
}
