/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class WindowFocusedParams {
  public readonly windowId: string;
  public readonly shownChatId: string | null;
  public readonly focused: boolean;

  public constructor(windowId: string, shownChatId: string | null, focused: boolean) {
    ArgumentException.throwIfNullOrWhitespace(windowId, Resources.windowIdField);
    if (!Object.isNull(shownChatId))
      ArgumentException.throwIfNullOrWhitespace(shownChatId, Resources.shownChatIdField);

    this.windowId = windowId;
    this.shownChatId = shownChatId;
    this.focused = focused;
  }

  public get shownConversationId(): string | null {
    return this.shownChatId;
  }

  public static fromJson(value: unknown, path?: string): WindowFocusedParams {
    const reader = JsonReader.fromValue(value, path);
    return new WindowFocusedParams(reader.readNonBlankString(Resources.windowIdField), reader.readNullableString(Resources.shownChatIdField),
      reader.readBoolean(Resources.focusedField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.windowIdField]: this.windowId,
      [Resources.shownChatIdField]: this.shownChatId,
      [Resources.focusedField]: this.focused
    };
  }
}
