/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources";
import { ComposerSettings } from "./composer-settings";

export class ComposerChoices {
  public readonly conversations: ReadonlyMap<string, ComposerSettings>;

  public constructor(conversations: ReadonlyMap<string, ComposerSettings> = new Map()) {
    this.conversations = conversations;
  }

  public static fromJson(value: unknown): ComposerChoices {
    if (!Object.isObject(value) || Array.isArray(value))
      return new ComposerChoices();
    const record: Record<string, unknown> = { ...value };
    const stored = Resources.chatChoicesField in record ? record[Resources.chatChoicesField] : record[Resources.legacyChatChoicesField];
    const conversations = new Map<string, ComposerSettings>();
    for (const [conversationId, choice] of Object.isObject(stored) && !Array.isArray(stored) ? Object.entries({ ...stored }) : []) {
      const settings = ComposerSettings.fromJson(choice);
      if (!Object.isNull(settings))
        conversations.set(conversationId, settings);
    }
    return new ComposerChoices(conversations);
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatChoicesField]: Object.fromEntries([...this.conversations].map(([conversationId, settings]) => [conversationId, settings.toJson()]))
    };
  }

  public remember(conversationId: string, settings: ComposerSettings): ComposerChoices {
    return new ComposerChoices(new Map(this.conversations).set(conversationId, settings));
  }
}
