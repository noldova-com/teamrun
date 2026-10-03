/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, effect, inject, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { AppearanceService } from "@noldova/teamrun-shell-ui";

import { AppearancePreferences } from "../models/appearance-preferences";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { SettingsService } from "./settings.service";

@Injectable({ providedIn: "root" })
export class AppearanceSettingsService {
  private readonly appearance: AppearanceService = inject(AppearanceService);
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private kept: AppearancePreferences | null = AppearancePreferences.fromJson(this.bridge.initialAppearance);

  public constructor() {
    const settings = inject(SettingsService);
    if (!Object.isNull(this.kept))
      this.apply(this.kept);
    effect(() => {
      const values = settings.values();
      if (settings.definitions().length === 0)
        return;
      const preferences = AppearancePreferences.fromSettings(name => values.get(name));
      if (!Object.isNull(preferences))
        untracked(() => this.follow(preferences));
    });
  }

  private follow(preferences: AppearancePreferences): void {
    this.apply(preferences);
    if (preferences.equals(this.kept))
      return;
    this.kept = preferences;
    this.bridge.keepAppearance(preferences.toJson());
  }

  private apply(preferences: AppearancePreferences): void {
    this.appearance.setModePreference(preferences.mode);
    this.appearance.setTypography(preferences.typography);
  }
}
