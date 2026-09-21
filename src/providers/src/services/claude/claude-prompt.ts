/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { TurnRequest } from "@noldova/teamrun-core";

import { Resources } from "../../resources.js";

export class ClaudePrompt implements AsyncIterable<SDKUserMessage> {
  private readonly message: SDKUserMessage;

  public constructor(request: TurnRequest) {
    const content: Exclude<SDKUserMessage["message"]["content"], string> = [{ type: Resources.textInputType, text: request.prompt }];
    for (const attachment of request.attachments) {
      const mediaType = attachment.mediaType;
      if (mediaType === Resources.pngMediaType || mediaType === Resources.jpegMediaType || mediaType === Resources.gifMediaType || mediaType === Resources.webpMediaType)
        content.push({ type: Resources.imageInputType, source: {
          type: Resources.base64SourceType, media_type: mediaType, data: readFileSync(attachment.path).toString(Resources.base64SourceType)
        } });
    }
    this.message = { type: Resources.userMessageType, message: { role: Resources.userMessageType, content }, parent_tool_use_id: null };
  }

  public async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    yield this.message;
  }
}
