/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, effect, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { Theme } from "../models/theme";
import { Resources } from "../resources";
import { BridgeService } from "./bridge.service";
import { ThemeService } from "./theme.service";

@Injectable({ providedIn: "root" })
export class TitleBarService {
  private readonly bridge: BridgeService = inject(BridgeService);
  private readonly theme: ThemeService = inject(ThemeService);

  public readonly dark: Signal<boolean> = this.theme.dark;

  public constructor() {
    effect(() => this.apply(this.theme.active()));
  }

  private apply(theme: Theme): void {
    const background = Resources.titleBarBackground.resolve(theme);
    const foreground = Resources.titleBarForeground.resolve(theme);
    if (Object.isNull(background) || Object.isNull(foreground))
      return;
    void this.bridge.setTitleBar(background, foreground);
  }
}
