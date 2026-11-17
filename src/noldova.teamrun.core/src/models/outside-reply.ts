/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { OutsideReplyState } from "../enums/outside-reply-state.js";
import { Resources } from "../resources.js";

export class OutsideReply {
  public readonly messageId: string;
  public readonly state: OutsideReplyState;
  public readonly text: string | null;

  public constructor(messageId: string, state: OutsideReplyState, text: string | null = null) {
    this.messageId = messageId;
    this.state = state;
    this.text = text;
  }

  public get hasEnded(): boolean {
    return [OutsideReplyState.Unknown, OutsideReplyState.Answered, OutsideReplyState.Failed].includes(this.state);
  }

  public toJson(): JsonObject {
    return {
      [Resources.outsideMessageIdField]: this.messageId,
      [Resources.stateField]: this.state.toLowerCase(),
      ...this.state === OutsideReplyState.Answered ? { [Resources.replyField]: this.text } : {},
      ...this.state === OutsideReplyState.Failed ? { [Resources.errorField]: this.text } : {}
    };
  }
}
