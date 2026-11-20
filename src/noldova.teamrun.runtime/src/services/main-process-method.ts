/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, type RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class MainProcessMethod implements IMethodHandler {
  private readonly method: IMethodHandler;
  private readonly field: string | null;

  public constructor(method: IMethodHandler, field: string | null = null) {
    this.method = method;
    this.field = field;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    if (request.client !== ShellClients.mainProcess && this.sets(request.payload))
      throw new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.mainProcessOnly,
        { [Resources.errorField]: FailureCode.Unauthorized, [Resources.argumentsField]: [] }));

    return await this.method.handleAsync(request);
  }

  private sets(payload: JsonValue): boolean {
    return Object.isNull(this.field) || (MainProcessMethod.isJsonObject(payload) && !Object.isNullOrUndefined(payload[this.field]));
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
