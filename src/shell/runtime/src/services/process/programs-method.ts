/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { ProgramStatusList } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";

export class ProgramsMethod implements IMethodHandler {
  private readonly read: () => ProgramStatusList;

  public constructor(read: () => ProgramStatusList) {
    this.read = read;
  }

  public async handleAsync(_context: RequestContext): Promise<JsonValue> {
    return this.read().toJson();
  }
}
