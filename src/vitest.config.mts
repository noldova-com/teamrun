import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@noldova/teamrun-shell-ui": fileURLToPath(new URL("./shell/ui/src/api/index.ts", import.meta.url)),
      "@noldova/teamrun-shell-window": fileURLToPath(new URL("./shell/window/src/api/index.ts", import.meta.url))
    }
  }
});
