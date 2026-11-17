/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader, JsonValue } from "@noldova/context.json";

import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import { Resources } from "../../resources.js";
import type { Deadline } from "../deadline.js";

export class CodexActivity implements INotificationHandler {
  private readonly threadId: string;
  private readonly follows: (threadId: JsonValue | null) => boolean;
  private readonly silence: Deadline;

  public constructor(threadId: string, follows: (threadId: JsonValue | null) => boolean, silence: Deadline) {
    this.threadId = threadId;
    this.follows = follows;
    this.silence = silence;
  }

  public handleNotificationAsync(_method: string, params: JsonReader): Promise<void> {
    const threadId = params.hasField(Resources.threadIdField) ? params.readValue(Resources.threadIdField) : null;
    if (threadId === this.threadId || this.follows(threadId))
      this.silence.extend();
    return Promise.resolve();
  }
}
