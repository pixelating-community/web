import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  optimizeDeps: {
    include: [
      // React Query imports a named export from this CJS shim in dev.
      // Force pre-bundling so Vite exposes ESM-compatible named exports.
      "use-sync-external-store/shim/with-selector.js",
    ],
  },
  plugins: [tsconfigPaths(), tanstackStart(), tailwindcss(), react()],
});
