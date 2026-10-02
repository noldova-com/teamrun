/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { RequestContext } from "../../models/request-context.js";

export class MoveAsideMethod implements IMethodHandler {
  private readonly moveAside: () => Promise<void>;

  public constructor(moveAside: () => Promise<void>) {
    this.moveAside = moveAside;
  }

  public async handleAsync(_context: RequestContext): Promise<JsonValue> {
    await this.moveAside();
    return null;
  }
}
