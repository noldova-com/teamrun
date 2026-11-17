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

export class ChatFindHit {
  public readonly chatId: string;
  public readonly projectId: string | null;
  public readonly title: string;
  public readonly teammateNames: readonly string[];
  public readonly updatedAt: string;

  public constructor(chatId: string, projectId: string | null, title: string, teammateNames: readonly string[], updatedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(projectId))
      ArgumentException.throwIfNullOrWhitespace(projectId, Resources.projectIdField);
    for (const name of teammateNames)
      ArgumentException.throwIfNullOrWhitespace(name, Resources.teammateNamesField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);

    this.chatId = chatId;
    this.projectId = projectId;
    this.title = title;
    this.teammateNames = [...teammateNames];
    this.updatedAt = updatedAt;
  }

  public static fromJson(value: unknown, path?: string): ChatFindHit {
    const reader = JsonReader.fromValue(value, path);
    return new ChatFindHit(
      reader.readNonBlankString(Resources.chatIdField),
      Object.isNull(reader.readNullableString(Resources.projectIdField)) ? null : reader.readNonBlankString(Resources.projectIdField),
      reader.readString(Resources.titleField),
      reader.readStringArray(Resources.teammateNamesField),
      reader.readNonBlankString(Resources.updatedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.projectIdField]: this.projectId,
      [Resources.titleField]: this.title,
      [Resources.teammateNamesField]: [...this.teammateNames],
      [Resources.updatedAtField]: this.updatedAt
    };
  }
}
