/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";

export class ForcedColorsFixture {
  private static readonly FEATURE: string = "forced-colors";
  private static readonly ACTIVE: string = "active";
  private static readonly NONE: string = "none";

  public static activateAsync(): Promise<unknown> {
    return ForcedColorsFixture.emulateAsync(ForcedColorsFixture.ACTIVE);
  }

  public static resetAsync(): Promise<unknown> {
    return ForcedColorsFixture.emulateAsync(ForcedColorsFixture.NONE);
  }

  public static resolve(color: string): string {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = color;
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }

  private static emulateAsync(value: string): Promise<unknown> {
    return cdp().send("Emulation.setEmulatedMedia", { features: [{ name: ForcedColorsFixture.FEATURE, value }] });
  }
}
