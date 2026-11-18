import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // The native build writes and locks files under src-tauri/target while it compiles; watching
    // them stops the dev server on Windows (EBUSY) and serves nothing on any platform.
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_"],
  // The app draws with the system WebKit; macOS 12.0, the declared floor, ships WebKit 15. Vite's
  // default (Safari 16) let syntax that engine cannot parse into the bundle (CR265).
  build: {
    target: "safari15",
  },
});
