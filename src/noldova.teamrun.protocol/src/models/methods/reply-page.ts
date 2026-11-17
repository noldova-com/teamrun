/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { ReplySummary } from "../reply-summary.js";

export class ReplyPage {
  public readonly replies: readonly ReplySummary[];
  public readonly hasEarlier: boolean;
  public readonly hasLater: boolean;
  public readonly ranCommands: boolean;

  public constructor(replies: readonly ReplySummary[], hasEarlier: boolean, hasLater: boolean, ranCommands: boolean = false) {
    this.replies = [...replies];
    this.hasEarlier = hasEarlier;
    this.hasLater = hasLater;
    this.ranCommands = ranCommands;
  }

  public static fromJson(value: unknown, path?: string): ReplyPage {
    const reader = JsonReader.fromValue(value, path);
    return new ReplyPage(reader.readObjectArray(Resources.repliesField).map(t => ReplySummary.fromJson(t.toJson(), t.path)),
      reader.readBoolean(Resources.hasEarlierField), reader.readBoolean(Resources.hasLaterField),
      reader.hasField(Resources.ranCommandsField) ? reader.readBoolean(Resources.ranCommandsField) : false);
  }

  public toJson(): JsonObject {
    return { [Resources.repliesField]: this.replies.map(t => t.toJson()), [Resources.hasEarlierField]: this.hasEarlier, [Resources.hasLaterField]: this.hasLater,
      [Resources.ranCommandsField]: this.ranCommands };
  }
}
