/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { defineConfig } from "playwright/test";

const output = path.resolve(import.meta.dirname, "..", "..", "..", "..", "_build", "e2e");

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.spec.ts",
  timeout: 300_000,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: path.join(output, "results"),
  reporter: [["list"], ["json", { outputFile: path.join(output, "report.json") }]]
});
