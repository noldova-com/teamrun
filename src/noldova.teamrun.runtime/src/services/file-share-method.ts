/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMethodHandler, IRuntimePartContext, RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { AttachmentShare, MessageAttachment, Resources } from "@noldova/teamrun.protocol";

export class FileShareMethod implements IMethodHandler {
  private readonly method: IMethodHandler;
  private readonly context: Pick<IRuntimePartContext, "files">;

  public constructor(method: IMethodHandler, context: Pick<IRuntimePartContext, "files">) {
    this.method = method;
    this.context = context;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    const file = MessageAttachment.fromJson(await this.method.handleAsync(request));
    return new AttachmentShare(await this.context.files.shareAsync(file.path, request, { mediaType: file.mediaType, lifetime: Resources.fileShareLifetime })).toJson();
  }
}
