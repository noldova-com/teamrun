/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import { ShortScreenshotNames } from "../../../../../scripts/angular/short-screenshot-names.ts";

export default defineConfig({
  test: {
    include: ["long-title.fixture.ts"],
    attachmentsDir: process.env["NOLDOVA_FAILURE_SCREENSHOT_ATTACHMENTS"],
    api: { port: 24315 },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      commands: { __vitest_screenshot: new ShortScreenshotNames().screenshot }
    }
  }
});
