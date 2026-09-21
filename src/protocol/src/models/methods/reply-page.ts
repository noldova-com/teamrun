/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { ReplySummary } from "../reply-summary.js";

export class ReplyPage {
  public readonly replies: readonly ReplySummary[];
  public readonly hasEarlier: boolean;
  public readonly hasLater: boolean;

  public constructor(replies: readonly ReplySummary[], hasEarlier: boolean, hasLater: boolean) {
    this.replies = [...replies];
    this.hasEarlier = hasEarlier;
    this.hasLater = hasLater;
  }

  public static fromJson(value: unknown, path?: string): ReplyPage {
    const reader = JsonReader.fromValue(value, path);
    return new ReplyPage(reader.readObjectArray(Resources.repliesField).map(t => ReplySummary.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasEarlierField), reader.readBoolean(Resources.hasLaterField));
  }

  public toJson(): JsonObject {
    return { [Resources.repliesField]: this.replies.map(t => t.toJson()), [Resources.hasEarlierField]: this.hasEarlier, [Resources.hasLaterField]: this.hasLater };
  }
}
