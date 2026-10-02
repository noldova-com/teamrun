/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "../../../../../_build/ui/results",
  timeout: 60000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../../../../_build/ui/report", open: "never" }],
    ["json", { outputFile: "../../../../../_build/ui/report.json" }]
  ]
});
