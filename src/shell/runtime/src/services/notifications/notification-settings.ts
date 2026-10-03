/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { SettingKey } from "@noldova/teamrun-shell-protocol";

import type { SettingsService } from "../settings/settings-service.js";
import { ShellSettings } from "../settings/shell-settings.js";

export class NotificationSettings {
  private readonly settings: SettingsService | null;

  public constructor(settings: SettingsService | null) {
    this.settings = settings;
  }

  public get quietDevices(): readonly string[] {
    if (Object.isNull(this.settings))
      return [];
    return [...this.settings.readDevices(ShellSettings.doNotDisturb)].filter(([, value]) => value === true).map(([device]) => device).sort();
  }

  public get mutedModules(): readonly string[] {
    const value = Object.isNull(this.settings) ? [] : this.settings.read(new SettingKey(ShellSettings.mutedModules));
    return Array.isArray(value) ? value.filter(t => Object.isString(t)) : [];
  }

  public isQuiet(device: string): boolean {
    return !Object.isNull(this.settings) && this.settings.read(new SettingKey(ShellSettings.doNotDisturb, null, device)) === true;
  }

  public isNotificationSetting(name: string): boolean {
    return name === ShellSettings.doNotDisturb.text || name === ShellSettings.mutedModules.text;
  }
}
