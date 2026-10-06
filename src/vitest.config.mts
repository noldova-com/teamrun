/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import ClassMetadataCoverage from "../scripts/angular/class-metadata-coverage.ts";

const compilerOptions: { paths: Record<string, string[]> } = JSON.parse(readFileSync(new URL("./tsconfig.json", import.meta.url), "utf8")).compilerOptions;

export default defineConfig({
  plugins: [new ClassMetadataCoverage()],
  resolve: {
    alias: Object.fromEntries(Object.entries(compilerOptions.paths).map(([name, targets]) => [name, fileURLToPath(new URL(String(targets[0]), import.meta.url))]))
  },
  test: {
    coverage: {
      reportsDirectory: fileURLToPath(new URL("../_build/angular-coverage", import.meta.url))
    }
  }
});
