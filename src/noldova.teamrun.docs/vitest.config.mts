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

import { ClassMetadataCoverage } from "../../scripts/angular/class-metadata-coverage.ts";
import { ShortScreenshotNames } from "../../scripts/angular/short-screenshot-names.ts";

const compilerOptions: { paths: Record<string, string[]> } = JSON.parse(readFileSync(new URL("./tsconfig.json", import.meta.url), "utf8")).compilerOptions;
const wildcard = "*";
const special = /[.*+?^${}()|[\]\\]/gu;

const aliasOf = (name: string, target: string): { find: string | RegExp; replacement: string } => name.endsWith(wildcard)
  ? { find: new RegExp(`^${name.slice(0, -wildcard.length).replace(special, "\\$&")}(.*)$`, "u"), replacement: `${fileURLToPath(new URL(target.slice(0, -wildcard.length), import.meta.url))}$1` }
  : { find: name, replacement: fileURLToPath(new URL(target, import.meta.url)) };

export default defineConfig({
  plugins: [
    new ClassMetadataCoverage()
  ],
  resolve: {
    alias: Object.entries(compilerOptions.paths).map(([name, targets]) => aliasOf(name, String(targets[0])))
  },
  test: {
    api: { port: 24316, host: "127.0.0.1" },
    expect: { poll: { timeout: 15_000 } },
    hookTimeout: 30_000,
    testTimeout: 30_000,
    browser: { commands: { __vitest_screenshot: new ShortScreenshotNames().screenshot } },
    coverage: {
      reportsDirectory: fileURLToPath(new URL("../../_build/docs-coverage", import.meta.url))
    }
  }
});
