/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShellClients } from "@noldova/desktop.protocol";
import type { IMethodHandler, RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { IConversationEngine } from "@noldova/teamrun.core";
import type { MessageSendParams } from "@noldova/teamrun.protocol";

import { DispatchedMethod } from "./dispatched-method.js";

export class RequestedModeMethod implements IMethodHandler {
  private readonly method: IMethodHandler;
  private readonly engine: Pick<IConversationEngine, "refuseRaisedModeAsync">;
  private readonly read: (payload: JsonValue) => MessageSendParams;
  private readonly outside: ((payload: JsonValue) => Promise<JsonValue>) | null;

  public constructor(method: IMethodHandler, engine: Pick<IConversationEngine, "refuseRaisedModeAsync">, read: (payload: JsonValue) => MessageSendParams,
    outside: ((payload: JsonValue) => Promise<JsonValue>) | null = null) {
    this.method = method;
    this.engine = engine;
    this.read = read;
    this.outside = outside;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    if (request.client === ShellClients.mainProcess)
      return await this.method.handleAsync(request);
    const params = this.paramsOf(request.payload);
    try {
      if (!Object.isNull(params))
        await this.engine.refuseRaisedModeAsync(params);
      if (!Object.isNull(this.outside))
        return await this.outside(request.payload);
    }
    catch (error) {
      throw DispatchedMethod.failureOf(error);
    }
    return await this.method.handleAsync(request);
  }

  private paramsOf(payload: JsonValue): MessageSendParams | null {
    try {
      return this.read(payload);
    }
    catch {
      return null;
    }
  }
}
