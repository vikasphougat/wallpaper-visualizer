import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";

// Explicit root — required when the project lives under a folder whose name
// contains "#" (e.g. #Github_Projects). Without this, Vite can fail to resolve
// /src/main.tsx because "#" is treated as a URL fragment, not part of the path.
const root = fileURLToPath(new URL(".", import.meta.url));
const src = path.join(root, "src");

// https://vite.dev/config/
//
// HTTPS is needed for WebXR/camera when testing on a phone over the LAN.
// Install the optional plugin to enable it automatically:
//   npm i -D @vitejs/plugin-basic-ssl
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
    root,
    plugins,
    resolve: {
      alias: {
        "@": src,
      },
    },
    optimizeDeps: {
      include: [
        "@tensorflow/tfjs",
        "@tensorflow/tfjs-backend-wasm",
        "@tensorflow-models/deeplab",
      ],
    },
    server: {
      host: true,
      fs: {
        // Allow serving from this root even when the path contains special chars.
        allow: [root],
      },
    },
  };
});
