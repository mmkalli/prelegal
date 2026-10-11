import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run in Node by default; component tests opt into a DOM with `// @vitest-environment jsdom`.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
});
