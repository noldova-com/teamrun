/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { SettingKey } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { SettingsService } from "./settings.service.js";

export class SettingResetMethod implements IMethodHandler {
  private readonly settings: SettingsService;

  public constructor(settings: SettingsService) {
    this.settings = settings;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    const key = SettingKey.fromJson(context.payload);
    this.settings.reset(key);
    return Promise.resolve(null);
  }
}
