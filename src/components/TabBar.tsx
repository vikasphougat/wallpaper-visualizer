import { NavLink } from "react-router-dom";
import { useXRSupport } from "@/hooks/useXRSupport";

interface TabDef {
  to: string;
  label: string;
  glyph: string;
  hint: string;
}

const TABS: TabDef[] = [
  { to: "/photo", label: "Photo", glyph: "🖼", hint: "Try on a photo" },
  { to: "/room", label: "3D Room", glyph: "🧊", hint: "View in 3D" },
  { to: "/ar", label: "Live AR", glyph: "📷", hint: "Point your camera" },
  { to: "/catalog", label: "Browse", glyph: "❖", hint: "Wallpaper catalog" },
];

export function TabBar() {
  const xr = useXRSupport();

  return (
    <nav className="tabbar" aria-label="Visualisation modes">
      {TABS.map((tab) => {
        const isAR = tab.to === "/ar";
        const badge = isAR
          ? xr === "supported"
            ? "AR"
            : xr === "checking"
              ? "…"
              : "—"
          : null;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `tabbar__item${isActive ? " is-active" : ""}`}
            title={isAR && xr === "unsupported" ? "Live AR needs a supported phone/browser" : tab.hint}
          >
            <span className="tabbar__glyph" aria-hidden>{tab.glyph}</span>
            <span className="tabbar__label">{tab.label}</span>
            {badge && (
              <span className={`tabbar__badge tabbar__badge--${xr}`} aria-hidden>
                {badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
