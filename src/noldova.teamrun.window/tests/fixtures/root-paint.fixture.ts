/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Theme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

export class RootPaint {
  public static applyAsync(theme: Theme, mode: ThemeMode = ThemeMode.Light): Promise<void> {
    return RootPaint.observedAsync(() => AppearanceFixture.apply(theme, mode));
  }

  public static resetAsync(): Promise<void> {
    return RootPaint.observedAsync(() => AppearanceFixture.reset());
  }

  private static observedAsync(paint: () => void): Promise<void> {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(document.documentElement, { attributeFilter: ["style"] });
      paint();
    });
  }
}
