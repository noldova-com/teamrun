/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { ModuleHost } from "./module-host.js";

export class ModulesMethod implements IMethodHandler {
  private readonly modules: ModuleHost;

  public constructor(modules: ModuleHost) {
    this.modules = modules;
  }

  public async handleAsync(_context: RequestContext): Promise<JsonValue> {
    return this.modules.report.toJson();
  }
}
