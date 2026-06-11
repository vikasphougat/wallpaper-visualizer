import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { TabBar } from "@/components/TabBar";
import { WallpaperStrip } from "@/components/WallpaperStrip";

// Lazy-load each feature so heavy engines (WebGL/TF.js) only load on demand.
const CatalogPage = lazy(() => import("@/features/catalog/CatalogPage"));
const PhotoOverlayPage = lazy(() => import("@/features/photo-overlay/PhotoOverlayPage"));
const RoomPage = lazy(() => import("@/features/room-3d/RoomPage"));
const ARPage = lazy(() => import("@/features/ar-live/ARPage"));

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          <span className="app__logo" aria-hidden>◧</span> Wallpaper Visualizer
        </h1>
        <p className="app__tagline">See any wallpaper on your wall — photo, 3D, or live AR.</p>
      </header>

      <WallpaperStrip />

      <main className="app__main">
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/photo" replace />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/photo" element={<PhotoOverlayPage />} />
            <Route path="/room" element={<RoomPage />} />
            <Route path="/ar" element={<ARPage />} />
            <Route path="*" element={<Navigate to="/photo" replace />} />
          </Routes>
        </Suspense>
      </main>

      <TabBar />
    </div>
  );
}
