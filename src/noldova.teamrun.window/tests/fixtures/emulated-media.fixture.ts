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
  private static readonly DEFAULTS: Readonly<Record<string, string>> = { "forced-colors": "none", "prefers-reduced-motion": "no-preference" };
  private static sent: string | null = null;

  public static emulateAsync(name: string, value: string): Promise<unknown> {
    return EmulatedMediaFixture.emulateEachAsync({ [name]: value });
  }

  public static emulateEachAsync(features: Readonly<Record<string, string>>): Promise<unknown> {
    return EmulatedMediaFixture.sendAsync({ ...EmulatedMediaFixture.DEFAULTS, ...features });
  }

  public static resetAsync(): Promise<unknown> {
    return EmulatedMediaFixture.sendAsync(EmulatedMediaFixture.DEFAULTS);
  }

  private static async sendAsync(features: Readonly<Record<string, string>>): Promise<unknown> {
    const sending = JSON.stringify(features);
    if (sending === EmulatedMediaFixture.sent)
      return undefined;
    EmulatedMediaFixture.sent = null;
    const answer = await cdp().send("Emulation.setEmulatedMedia", { features: Object.entries(features).map(([name, value]) => ({ name, value })) });
    EmulatedMediaFixture.sent = sending;
    return answer;
  }
}
