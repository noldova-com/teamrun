/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { ChatFindHit } from "./chat-find-hit.js";

export class ChatFindResult {
  public readonly hits: readonly ChatFindHit[];
  public readonly total: number;

  public constructor(hits: readonly ChatFindHit[], total: number) {
    if (!Number.isInteger(total) || total < hits.length)
      throw new ArgumentOutOfRangeException(Resources.totalField, total);

    this.hits = [...hits];
    this.total = total;
  }

  public static fromJson(value: unknown, path?: string): ChatFindResult {
    const reader = JsonReader.fromValue(value, path);
    return new ChatFindResult(reader.readObjectArray(Resources.hitsField).map(t => ChatFindHit.fromJson(t.toJson(), t.path)), reader.readInteger(Resources.totalField));
  }

  public toJson(): JsonObject {
    return { [Resources.hitsField]: this.hits.map(t => t.toJson()), [Resources.totalField]: this.total };
  }
}
