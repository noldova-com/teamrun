/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IMethodHandler,
  type IToolDescriptor,
  type IToolHandler,
  RequestContext,
  type ToolCall,
  ToolContent,
  ToolFailure,
  ToolFailureCode,
  ToolFailureException,
  ToolResult
} from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import type { ISenderTokens } from "@noldova/teamrun.core";

import { Resources } from "../resources.js";
import { MethodFailures } from "./method-failures.js";

export class SubAgentTool implements IToolHandler {
  private readonly moduleId: string;
  private readonly descriptor: IToolDescriptor;
  private readonly handler: IMethodHandler;
  private readonly senders: ISenderTokens;
  private readonly paramsOf: (input: JsonObject, token: string) => JsonObject;
  private readonly noRunningTurn: string;

  public constructor(moduleId: string, descriptor: IToolDescriptor, handler: IMethodHandler, senders: ISenderTokens,
    paramsOf: (input: JsonObject, token: string) => JsonObject, noRunningTurn: string = Resources.subAgentNoRunningTurn) {
    this.moduleId = moduleId;
    this.descriptor = descriptor;
    this.handler = handler;
    this.senders = senders;
    this.paramsOf = paramsOf;
    this.noRunningTurn = noRunningTurn;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const token = this.senders.senderTokenOf(call.session);
    if (Object.isNull(token))
      throw new ToolFailureException(new ToolFailure(ToolFailureCode.Refused, this.noRunningTurn));
    if (this.descriptor.marksSending === true)
      call.markSending();
    try {
      const result = await this.handler.handleAsync(new RequestContext(Resources.toolsClient, this.paramsOf(call.arguments, token), call.signal,
        Resources.toolsConnection));
      return new ToolResult([ToolContent.fromText(JSON.stringify(result), Resources.formatToolOrigin(this.descriptor.name))]);
    }
    catch (error) {
      throw new ToolFailureException(MethodFailures.of(this.moduleId, error));
    }
  }
}
