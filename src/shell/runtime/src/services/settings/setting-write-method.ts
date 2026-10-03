/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { SettingValue } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import { SettingFailures } from "./setting-failures.js";
import type { SettingsService } from "./settings-service.js";

export class SettingWriteMethod implements IMethodHandler {
  private readonly settings: SettingsService;

  public constructor(settings: SettingsService) {
    this.settings = settings;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    const write = SettingValue.fromJson(context.payload);
    SettingFailures.translate(() => this.settings.write(write));
    return Promise.resolve(null);
  }
}
