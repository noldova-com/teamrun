/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { ChatPosition } from "../chat-position.js";
import { Resources } from "../../resources.js";

export class ReadingPositionSaveParams {
  public readonly positions: readonly ChatPosition[];
  public readonly cleared: readonly string[];
  public readonly dropped: readonly ChatPosition[];

  public constructor(positions: readonly ChatPosition[], cleared: readonly string[] = [], dropped: readonly ChatPosition[] = []) {
    for (const id of cleared)
      ArgumentException.throwIfNullOrWhitespace(id, Resources.clearedField);
    const ids = [...positions.map(t => t.chatId), ...cleared, ...dropped.map(t => t.chatId)];
    if (new Set(ids).size !== ids.length)
      throw new ArgumentException(Resources.readingPositionRepeated, Resources.positionsField);

    this.positions = [...positions];
    this.cleared = [...cleared];
    this.dropped = [...dropped];
  }

  public static fromJson(value: unknown, path?: string): ReadingPositionSaveParams {
    const reader = JsonReader.fromValue(value, path);
    return new ReadingPositionSaveParams(
      reader.readObjectArray(Resources.positionsField).map(t => ChatPosition.fromJson(t.toJson(), t.path)),
      reader.readStringArray(Resources.clearedField),
      reader.readObjectArray(Resources.droppedField).map(t => ChatPosition.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.positionsField]: this.positions.map(t => t.toJson()),
      [Resources.clearedField]: [...this.cleared],
      [Resources.droppedField]: this.dropped.map(t => t.toJson())
    };
  }
}
