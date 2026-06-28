import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plain Vite + React setup — no extra tooling needed for this single-page dashboard.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
