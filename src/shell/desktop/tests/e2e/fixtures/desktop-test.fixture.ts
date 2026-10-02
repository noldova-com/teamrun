/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { test as base, expect } from "@playwright/test";

import DesktopApplicationFixture from "./desktop-application.fixture.ts";

export const test = base.extend<{ desktop: DesktopApplicationFixture; desktopEnvironment: Readonly<Record<string, string>> }>({
  desktopEnvironment: [{}, { option: true }],
  desktop: async ({ desktopEnvironment }, use, testInfo) => {
    const desktop = await DesktopApplicationFixture.launchAsync(testInfo, desktopEnvironment);
    try {
      await use(desktop);
    }
    finally {
      await desktop.disposeAsync();
    }
    expect(desktop.failures).toEqual([]);
  }
});

export { expect };
