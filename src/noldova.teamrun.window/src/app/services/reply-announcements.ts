/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Approval, type Message, MessageStatus } from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, type Announcer } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ApprovalPermission } from "../models/approval-permission";

export class ReplyAnnouncements {
  private readonly announcer: Announcer;
  private readonly nameOf: (reply: Message) => string;
  private conversationId: string | null = null;
  private onScreen: boolean = false;
  private asked: ReadonlySet<string> | null = null;

  public constructor(announcer: Announcer, nameOf: (reply: Message) => string) {
    this.announcer = announcer;
    this.nameOf = nameOf;
  }

  public update(conversationId: string, onScreen: boolean, replies: readonly Message[], approvals: readonly Approval[], find: (messageId: string) => Message | null): void {
    const working = new Map(replies.map(t => [t.id, t]));
    const asking: (readonly [Message, Approval])[] = [];
    for (const approval of approvals) {
      const reply = working.get(approval.messageId) ?? find(approval.messageId);
      if (reply?.conversationId === conversationId)
        asking.push([reply, approval]);
    }
    const asked = this.asked;
    this.conversationId = conversationId;
    this.onScreen = onScreen;
    this.asked = new Set(asking.map(([, t]) => t.id));
    if (!onScreen || Object.isNull(asked))
      return;
    for (const [reply, approval] of asking)
      if (!asked.has(approval.id)) {
        const name = this.nameOf(reply);
        this.announce(Resources.formatAsks(name, ApprovalPermission.toRequest(approval, name, null).heading), `${Resources.approvalAskedKeyPrefix}${approval.id}`);
      }
  }

  public ended(reply: Message): void {
    if (this.onScreen && reply.conversationId === this.conversationId && reply.status === MessageStatus.Completed)
      this.announce(Resources.formatReplied(this.nameOf(reply)), `${Resources.replyEndedKeyPrefix}${reply.id}`);
  }

  private announce(text: string, key: string): void {
    this.announcer.announce(text, AnnouncementPoliteness.Polite, { key });
  }
}
