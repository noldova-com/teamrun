/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UUID } from "node:crypto";
import { readFileSync } from "node:fs";

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { TurnRequest } from "@noldova/teamrun.core";
import type { MessageAttachment } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class ClaudePrompt {
  public static create(request: TurnRequest, text: string, uuid: UUID): SDKUserMessage {
    return ClaudePrompt.of(text, request.attachments, uuid);
  }

  public static of(text: string, attachments: readonly MessageAttachment[], uuid: UUID): SDKUserMessage {
    const images: Exclude<SDKUserMessage["message"]["content"], string> = [];
    for (const attachment of attachments) {
      const mediaType = attachment.mediaType;
      if (mediaType === Resources.pngMediaType || mediaType === Resources.jpegMediaType || mediaType === Resources.gifMediaType || mediaType === Resources.webpMediaType)
        images.push({ type: Resources.imageInputType, source: {
          type: Resources.base64SourceType, media_type: mediaType, data: readFileSync(attachment.path).toString(Resources.base64SourceType)
        } });
    }
    const content: SDKUserMessage["message"]["content"] = images.length === 0 ? text : [{ type: Resources.textInputType, text }, ...images];
    return { type: Resources.userMessageType, message: { role: Resources.userMessageType, content }, parent_tool_use_id: null, uuid };
  }
}
