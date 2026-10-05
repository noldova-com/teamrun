/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { test as base, expect } from "@playwright/test";

import BuildVariantFixture from "./build-variant.fixture.ts";
import CleanupSteps from "./cleanup-steps.ts";
import DesktopApplicationFixture from "./desktop-application.fixture.ts";

export const test = base.extend<{
  desktop: DesktopApplicationFixture;
  desktopEnvironment: Readonly<Record<string, string>>;
  desktopDataFiles: Readonly<Record<string, string>>;
  desktopArguments: readonly string[];
  desktopVariant: string | null;
  desktopWindowPlacement: boolean;
}>({
  desktopEnvironment: [{}, { option: true }],
  desktopDataFiles: [{}, { option: true }],
  desktopArguments: [[], { option: true }],
  desktopVariant: [null, { option: true }],
  desktopWindowPlacement: [false, { option: true }],
  desktop: async ({ desktopEnvironment, desktopDataFiles, desktopArguments, desktopVariant, desktopWindowPlacement }, use, testInfo) => {
    let desktop: DesktopApplicationFixture | null = null;
    let failure: { readonly error: unknown } | null = null;
    try {
      if (desktopVariant !== null)
        await BuildVariantFixture.swapInAsync(desktopVariant);
      desktop = await DesktopApplicationFixture.launchAsync(testInfo, desktopEnvironment, desktopDataFiles, desktopArguments, desktopWindowPlacement);
      await use(desktop);
    }
    catch (error) {
      failure = { error };
    }
    const cleanup = await CleanupSteps.collectFailuresAsync([
      async () => {
        await desktop?.disposeAsync();
      },
      () => BuildVariantFixture.restoreAsync()
    ]);
    await CleanupSteps.attachAsync(testInfo, cleanup);
    if (failure !== null)
      throw failure.error;
    CleanupSteps.throwFailures(cleanup);
    expect(desktop?.failures).toEqual([]);
  }
});

export { expect };
