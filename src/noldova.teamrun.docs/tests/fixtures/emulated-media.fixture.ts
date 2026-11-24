/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";

export class EmulatedMediaFixture {
  private static readonly PLAYWRIGHT_DEFAULTS: ReadonlyMap<string, string> = new Map([["prefers-reduced-motion", "no-preference"],
    ["forced-colors", "none"], ["prefers-color-scheme", "light"], ["prefers-contrast", "no-preference"]]);
  private static readonly features: Map<string, string> = new Map(EmulatedMediaFixture.PLAYWRIGHT_DEFAULTS);

  public static emulateAsync(name: string, value: string): Promise<unknown> {
    EmulatedMediaFixture.features.set(name, value);
    return EmulatedMediaFixture.sendAsync();
  }

  public static holds(name: string, value: string): boolean {
    return EmulatedMediaFixture.features.get(name) === value;
  }

  public static resetAsync(): Promise<unknown> {
    for (const [name, value] of EmulatedMediaFixture.PLAYWRIGHT_DEFAULTS)
      EmulatedMediaFixture.features.set(name, value);
    return EmulatedMediaFixture.sendAsync();
  }

  private static sendAsync(): Promise<unknown> {
    return cdp().send("Emulation.setEmulatedMedia", { features: [...EmulatedMediaFixture.features].map(([name, value]) => ({ name, value })) });
  }
}
