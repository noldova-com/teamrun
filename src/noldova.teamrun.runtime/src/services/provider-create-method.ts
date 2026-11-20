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
import { ProviderCreateParams } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class ProviderCreateMethod implements IMethodHandler {
  private readonly method: IMethodHandler;

  public constructor(method: IMethodHandler) {
    this.method = method;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    if (request.client !== ShellClients.mainProcess && ProviderCreateMethod.namesFolder(request.payload))
      throw new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.mainProcessOnly,
        { [Resources.errorField]: FailureCode.Unauthorized, [Resources.argumentsField]: [] }));

    return await this.method.handleAsync(request);
  }

  private static namesFolder(payload: JsonValue): boolean {
    try {
      return !Object.isNull(ProviderCreateParams.fromJson(payload).profileDir);
    }
    catch {
      return false;
    }
  }
}
