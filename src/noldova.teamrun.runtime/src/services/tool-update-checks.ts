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
  private choice: string | null = null;

  public constructor(settings: IModuleSettings) {
    settings.onChanged(Resources.updateChecksSetting, t => {
      this.choice = Object.isString(t.value) ? t.value : null;
    });
  }

  public get runWithoutAsking(): boolean {
    return !Object.isNull(this.choice) && this.choice !== Resources.onRequestUpdateChecks;
  }
}
