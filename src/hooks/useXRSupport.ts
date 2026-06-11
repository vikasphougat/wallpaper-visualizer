import { useEffect, useState } from "react";

export type XRSupport = "checking" | "supported" | "unsupported";

/**
 * Feature-detect WebXR immersive-AR. Used to gate / badge the Live AR tab.
 * iOS Safari has no WebXR AR, so this resolves to "unsupported" there.
 */
export function useXRSupport(): XRSupport {
  const [support, setSupport] = useState<XRSupport>("checking");

  useEffect(() => {
    let cancelled = false;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr?.isSessionSupported) {
      setSupport("unsupported");
      return;
    }
    xr
      .isSessionSupported("immersive-ar")
      .then((ok) => !cancelled && setSupport(ok ? "supported" : "unsupported"))
      .catch(() => !cancelled && setSupport("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  return support;
}

// Minimal ambient typing so we don't need the full WebXR type package for detection.
interface XRSystem {
  isSessionSupported?: (mode: string) => Promise<boolean>;
}
