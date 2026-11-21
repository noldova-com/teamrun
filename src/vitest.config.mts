/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseSync } from "vite";
import { defineConfig } from "vitest/config";

import { ClassMetadataCoverage } from "../scripts/angular/class-metadata-coverage.ts";
import { PreBundleCheck } from "../scripts/angular/pre-bundle-check.ts";
import { PreBundleRun } from "../scripts/angular/pre-bundle-run.ts";
import { ShortScreenshotNames } from "../scripts/angular/short-screenshot-names.ts";
import { SpecTransformCheck } from "../scripts/angular/spec-transform-check.ts";

const compilerOptions: { paths: Record<string, string[]> } = JSON.parse(readFileSync(new URL("./tsconfig.spec.json", import.meta.url), "utf8")).compilerOptions;

export default defineConfig({
  plugins: [
    new PreBundleRun(fileURLToPath(new URL("..", import.meta.url)), process.env),
    new ClassMetadataCoverage(),
    new PreBundleCheck((file, code) => parseSync(file, code, { sourceType: "module" }).errors,
      fileURLToPath(new URL("../_build/angular-pre-bundle.json", import.meta.url))),
    ...new SpecTransformCheck(fileURLToPath(new URL("../_build/angular-spec-transforms", import.meta.url))).plugins
  ],
  optimizeDeps: {
    include: ["@noldova/context.json"]
  },
  resolve: {
    alias: Object.fromEntries(Object.entries(compilerOptions.paths).map(([name, targets]) => [name, fileURLToPath(new URL(String(targets[0]), import.meta.url))]))
  },
  test: {
    api: { port: 24315 },
    browser: { commands: { __vitest_screenshot: new ShortScreenshotNames().screenshot } },
    coverage: {
      reportsDirectory: fileURLToPath(new URL("../_build/angular-coverage", import.meta.url))
    },
    retry: process.env["NOLDOVA_TEST_RETRY"] === "1" ? 1 : 0
  }
});
