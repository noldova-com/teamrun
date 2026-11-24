/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EmulatedMediaFixture } from "./emulated-media.fixture";

export class ForcedColorsFixture {
  private static readonly FEATURE: string = "forced-colors";
  private static readonly NONE: string = "none";

  public static activateAsync(): Promise<unknown> {
    return ForcedColorsFixture.emulateAsync("active");
  }

  public static async resetAsync(): Promise<unknown> {
    if (EmulatedMediaFixture.holds(ForcedColorsFixture.FEATURE, ForcedColorsFixture.NONE))
      return undefined;
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
    return EmulatedMediaFixture.emulateAsync(ForcedColorsFixture.FEATURE, value);
  }
}
