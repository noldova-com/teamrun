/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GrantedFile, IMethodHandler, IRuntimePartContext, RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type IConversationEngine, Resources as CoreResources } from "@noldova/teamrun.core";
import { AttachmentInput, ErrorCode } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { DispatchedMethod } from "./dispatched-method.js";

export class GrantedAttachmentMethod implements IMethodHandler {
  private readonly method: IMethodHandler;
  private readonly context: Pick<IRuntimePartContext, "files">;
  private readonly engine: Pick<IConversationEngine, "prepareOpenedAttachmentAsync">;

  public constructor(method: IMethodHandler, context: Pick<IRuntimePartContext, "files">, engine: Pick<IConversationEngine, "prepareOpenedAttachmentAsync">) {
    this.method = method;
    this.context = context;
    this.engine = engine;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    const input = GrantedAttachmentMethod.grantedOf(request.payload);
    if (Object.isNull(input))
      return this.method.handleAsync(request);
    const file = await this.redeemAsync(input, request);
    try {
      return (await this.engine.prepareOpenedAttachmentAsync(input, file.handle)).toJson();
    }
    catch (error) {
      throw DispatchedMethod.failureOf(error);
    }
    finally {
      await file.closeAsync();
    }
  }

  private async redeemAsync(input: AttachmentInput, request: RequestContext): Promise<GrantedFile> {
    try {
      return await this.context.files.redeemAsync(input.grant!, request);
    }
    catch {
      throw DispatchedMethod.failureOf(new ServiceException(ErrorCode.InvalidParams, CoreResources.attachmentGrantRefused, [input.name]));
    }
  }

  private static grantedOf(payload: JsonValue): AttachmentInput | null {
    try {
      const input = AttachmentInput.fromJson(payload);
      return Object.isNull(input.grant) ? null : input;
    }
    catch {
      return null;
    }
  }
}
