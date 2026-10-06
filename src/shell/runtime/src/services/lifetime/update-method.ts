/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Failure, FailureCode, UpdateRequest } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import { Resources } from "../../resources.js";
import type { UpdatePreparation } from "./update-preparation.js";

export class UpdateMethod implements IMethodHandler {
  private readonly preparation: UpdatePreparation;

  public constructor(preparation: UpdatePreparation) {
    this.preparation = preparation;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const request = UpdateRequest.fromJson(context.payload);
    if (!path.isAbsolute(request.installation))
      throw new MethodFailureException(new Failure(FailureCode.InvalidParams, Resources.installationNotAbsolute));
    return (await this.preparation.prepareAsync(context.connection, request)).toJson();
  }
}
