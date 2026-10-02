/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { test as base, expect } from "@playwright/test";

import BuildVariantFixture from "./build-variant.fixture.ts";
import DesktopApplicationFixture from "./desktop-application.fixture.ts";

export const test = base.extend<{
  desktop: DesktopApplicationFixture;
  desktopEnvironment: Readonly<Record<string, string>>;
  desktopDataFiles: Readonly<Record<string, string>>;
  desktopArguments: readonly string[];
  desktopVariant: string | null;
}>({
  desktopEnvironment: [{}, { option: true }],
  desktopDataFiles: [{}, { option: true }],
  desktopArguments: [[], { option: true }],
  desktopVariant: [null, { option: true }],
  desktop: async ({ desktopEnvironment, desktopDataFiles, desktopArguments, desktopVariant }, use, testInfo) => {
    let desktop: DesktopApplicationFixture | null = null;
    try {
      if (desktopVariant !== null)
        await BuildVariantFixture.swapInAsync(desktopVariant);
      desktop = await DesktopApplicationFixture.launchAsync(testInfo, desktopEnvironment, desktopDataFiles, desktopArguments);
      await use(desktop);
    }
    finally {
      try {
        await desktop?.disposeAsync();
      }
      finally {
        if (desktop !== null)
          await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);
        await BuildVariantFixture.restoreAsync();
      }
    }
    expect(desktop.failures).toEqual([]);
  }
});

export { expect };
