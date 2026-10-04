/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";

export class MotionFixture {
  private static readonly FEATURE: string = "prefers-reduced-motion";

  public static reduceAsync(): Promise<unknown> {
    return MotionFixture.emulateAsync("reduce");
  }

  public static resetAsync(): Promise<unknown> {
    return MotionFixture.emulateAsync("no-preference");
  }

  private static emulateAsync(value: string): Promise<unknown> {
    return cdp().send("Emulation.setEmulatedMedia", { features: [{ name: MotionFixture.FEATURE, value }] });
  }
}
