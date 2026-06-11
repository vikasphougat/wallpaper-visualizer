import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
//
// HTTPS is needed for WebXR/camera when testing on a phone over the LAN.
// Install the optional plugin to enable it automatically:
//   npm i -D @vitejs/plugin-basic-ssl
// When present, the dev server is served over https:// (self-signed cert).
// When absent, it falls back to plain http:// (fine for Photo + 3D tabs).
export default defineConfig(async () => {
  const plugins: PluginOption[] = [react()];

  try {
    const basicSsl = (await import("@vitejs/plugin-basic-ssl")).default;
    plugins.push(basicSsl());
  } catch {
    // Plugin not installed — serve over HTTP. AR tab will report "not available"
    // over a LAN IP because it isn't a secure context. See README.
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: true,
    },
  };
});
