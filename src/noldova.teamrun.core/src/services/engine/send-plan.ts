/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Conversation, MessageSender, RequestedSettings, Teammate } from "@noldova/teamrun.protocol";

import type { ReplyWork } from "../../models/reply-work.js";
import type { WorkFolder } from "../../models/work-folder.js";

export class SendPlan {
  public readonly conversation: Conversation;
  public readonly folder: WorkFolder;
  public readonly origin: ReplyWork | null;
  public readonly sender: MessageSender | null;
  public readonly group: ReplyWork[] | null;
  public readonly mentions: readonly Teammate[];
  public readonly called: readonly Teammate[];
  /** The teammates who reply. */
  public readonly participants: readonly Teammate[];
  /** The default reply's settings, set exactly when the default teammate replies. */
  public readonly defaultReply: RequestedSettings | null;
  public readonly providerId: string | null;
  public readonly hop: number;
  public readonly limit: number;

  public constructor(conversation: Conversation, folder: WorkFolder, origin: ReplyWork | null, sender: MessageSender | null, group: ReplyWork[] | null,
    mentions: readonly Teammate[], called: readonly Teammate[], participants: readonly Teammate[], defaultReply: RequestedSettings | null,
    providerId: string | null, hop: number, limit: number) {
    this.conversation = conversation;
    this.folder = folder;
    this.origin = origin;
    this.sender = sender;
    this.group = group;
    this.mentions = mentions;
    this.called = called;
    this.participants = participants;
    this.defaultReply = defaultReply;
    this.providerId = providerId;
    this.hop = hop;
    this.limit = limit;
  }

  public get stopped(): boolean {
    return this.hop > this.limit;
  }
}
