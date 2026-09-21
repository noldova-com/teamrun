/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { ConversationSearchHit } from "./conversation-search-hit.js";

export class ConversationSearchResult {
  public readonly hits: readonly ConversationSearchHit[];

  public constructor(hits: readonly ConversationSearchHit[]) {
    this.hits = [...hits];
  }

  public static fromJson(value: unknown, path?: string): ConversationSearchResult {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationSearchResult(reader.readObjectArray(Resources.hitsField).map(t => ConversationSearchHit.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return { [Resources.hitsField]: this.hits.map(t => t.toJson()) };
  }
}
