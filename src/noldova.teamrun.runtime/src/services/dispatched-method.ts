/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, type RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { RequestDispatcher } from "@noldova/teamrun.core";
import { Request } from "@noldova/teamrun.protocol";
import type { ServiceResponseInfo } from "@noldova/teamrun.services";

import { Resources } from "../resources.js";

export class DispatchedMethod implements IMethodHandler {
  private static readonly CODES: readonly string[] = Object.values(FailureCode);

  private readonly method: string;
  private readonly dispatcher: RequestDispatcher;

  public constructor(method: string, dispatcher: RequestDispatcher) {
    this.method = method;
    this.dispatcher = dispatcher;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const response = await this.dispatcher.dispatch(new Request(Resources.requestId, this.method, context.payload), context.signal);
    if (Object.isNull(response.info))
      return response.payload;

    throw new MethodFailureException(DispatchedMethod.toFailure(response.info));
  }

  public static failureOf(error: unknown): MethodFailureException {
    return new MethodFailureException(DispatchedMethod.toFailure(RequestDispatcher.describe(error)));
  }

  private static toFailure(info: ServiceResponseInfo): Failure {
    const code = DispatchedMethod.CODES.includes(info.name) ? info.name as FailureCode : FailureCode.Internal;
    return new Failure(code, info.message, { [Resources.errorField]: info.name, [Resources.argumentsField]: [...info.arguments] });
  }
}
