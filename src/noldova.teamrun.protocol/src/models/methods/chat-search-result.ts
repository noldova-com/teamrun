/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { ChatSearchHit } from "./chat-search-hit.js";

export class ChatSearchResult {
  public readonly hits: readonly ChatSearchHit[];

  public constructor(hits: readonly ChatSearchHit[]) {
    this.hits = [...hits];
  }

  public static fromJson(value: unknown, path?: string): ChatSearchResult {
    const reader = JsonReader.fromValue(value, path);
    return new ChatSearchResult(reader.readObjectArray(Resources.hitsField).map(t => ChatSearchHit.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return { [Resources.hitsField]: this.hits.map(t => t.toJson()) };
  }
}
