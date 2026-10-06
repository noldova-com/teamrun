/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { SettingsQuery } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { SettingsService } from "./settings.service.js";

export class SettingsReadMethod implements IMethodHandler {
  private readonly settings: SettingsService;

  public constructor(settings: SettingsService) {
    this.settings = settings;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    return Promise.resolve(this.settings.snapshot(SettingsQuery.fromJson(context.payload).device).toJson());
  }
}
