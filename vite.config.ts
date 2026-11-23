import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import colorMixFallback from "./scripts/postcss_color_mix_fallback.mjs";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  // The app draws with the system WebKit; macOS 12.0, the declared floor, ships WebKit 15. Vite's
  // default (Safari 16) let syntax that engine cannot parse into the bundle (CR265).
  build: {
    target: "safari15",
  },
  // That engine also drops every declaration that uses color-mix(): a surface whose background was a
  // mix has none (CR281). The plugin writes a plain one before each.
  css: {
    postcss: { plugins: [colorMixFallback()] },
  },
});
