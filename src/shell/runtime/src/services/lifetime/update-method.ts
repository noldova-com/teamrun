/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { UpdateRequest } from "@noldova/teamrun-shell-protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { UpdatePreparation } from "./update-preparation.js";

export class UpdateMethod implements IMethodHandler {
  private readonly preparation: UpdatePreparation;

  public constructor(preparation: UpdatePreparation) {
    this.preparation = preparation;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    return (await this.preparation.prepareAsync(context.connection, UpdateRequest.fromJson(context.payload))).toJson();
  }
}
