/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IModuleSettings } from "@noldova/desktop.runtime";
import type { IToolUpdateChecks } from "@noldova/teamrun.core";

import { Resources } from "../resources.js";

export class ToolUpdateChecks implements IToolUpdateChecks {
  private readonly listeners: (() => void)[] = [];
  private choice: string | null = null;
  private hasChecked: boolean = false;

  public constructor(settings: IModuleSettings) {
    const stored = settings.read(Resources.updateChecksSetting);
    if (Object.isString(stored) && stored !== Resources.automaticUpdateChecks)
      this.choice = stored;
    settings.onChanged(Resources.updateChecksSetting, t => this.choose(Object.isString(t.value) ? t.value : null));
  }

  public takeCheck(): boolean {
    const allows = this.allows();
    if (allows)
      this.hasChecked = true;
    return allows;
  }

  public onAllowed(listener: () => void): void {
    this.listeners.push(listener);
  }

  private choose(choice: string | null): void {
    const allowed = this.allows();
    this.choice = choice;
    if (!allowed && this.allows())
      for (const listener of this.listeners)
        listener();
  }

  private allows(): boolean {
    return this.choice === Resources.automaticUpdateChecks || (this.choice === Resources.atStartUpdateChecks && !this.hasChecked);
  }
}
