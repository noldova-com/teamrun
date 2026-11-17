/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { PanelName } from "../../enums/panel-name.js";
import { Resources } from "../../resources.js";

export class PanelRequestedPayload {
  public readonly requestId: string;
  public readonly windowId: string;
  public readonly panel: PanelName;
  public readonly chatId: string | null;
  public readonly open: boolean;

  public constructor(requestId: string, windowId: string, panel: PanelName, chatId: string | null, open: boolean) {
    ArgumentException.throwIfNullOrWhitespace(requestId, Resources.requestIdField);
    ArgumentException.throwIfNullOrWhitespace(windowId, Resources.windowIdField);
    if (!Object.isNull(chatId))
      ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if ([PanelName.Chat, PanelName.Page].includes(panel) === Object.isNull(chatId))
      throw new ArgumentException(Resources.panelChatMismatch, Resources.chatIdField);

    this.requestId = requestId;
    this.windowId = windowId;
    this.panel = panel;
    this.chatId = chatId;
    this.open = open;
  }

  public get conversationId(): string | null {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): PanelRequestedPayload {
    const reader = JsonReader.fromValue(value, path);
    return new PanelRequestedPayload(reader.readNonBlankString(Resources.requestIdField), reader.readNonBlankString(Resources.windowIdField),
      reader.readOneOf(Resources.panelField, Object.values(PanelName)), reader.readNullableString(Resources.chatIdField),
      reader.readBoolean(Resources.openField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.requestIdField]: this.requestId,
      [Resources.windowIdField]: this.windowId,
      [Resources.panelField]: this.panel,
      [Resources.chatIdField]: this.chatId,
      [Resources.openField]: this.open
    };
  }
}
