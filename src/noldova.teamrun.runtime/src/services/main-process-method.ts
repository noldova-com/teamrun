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
import type { JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class MainProcessMethod implements IMethodHandler {
  private readonly method: IMethodHandler;

  public constructor(method: IMethodHandler) {
    this.method = method;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    if (request.client !== ShellClients.mainProcess)
      throw new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.mainProcessOnly,
        { [Resources.errorField]: FailureCode.Unauthorized, [Resources.argumentsField]: [] }));

    return await this.method.handleAsync(request);
  }
}
