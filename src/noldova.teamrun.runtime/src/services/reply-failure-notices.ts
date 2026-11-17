/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandRun, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import type { IRuntimePartContext, NotificationHandle } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { type IEventListener, type IWindowsService, Resources as CoreResources } from "@noldova/teamrun.core";
import { ConversationIdParams, DetailKind, type Event, EventName, Message, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class ReplyFailureNotices implements IEventListener, Disposable {
  private readonly context: Pick<IRuntimePartContext, "moduleId" | "postNotification" | "log">;
  private readonly windows: Pick<IWindowsService, "isShown" | "onShown">;
  private readonly posted: Map<string, NotificationHandle> = new Map();
  private readonly stopShown: () => void;

  public constructor(context: Pick<IRuntimePartContext, "moduleId" | "postNotification" | "log">, windows: Pick<IWindowsService, "isShown" | "onShown">) {
    this.context = context;
    this.windows = windows;
    this.stopShown = windows.onShown(t => this.dismiss(t));
  }

  public onEvent(event: Event): void {
    if (event.name === EventName.ConversationDeleted)
      this.dismiss(ConversationIdParams.fromJson(event.payload).conversationId);
    if (event.name !== EventName.MessageUpdated)
      return;
    const message = Message.fromJson(event.payload);
    if (message.author === MessageAuthor.Provider && message.status === MessageStatus.Failed && !this.windows.isShown(message.conversationId))
      this.post(message);
  }

  public [Symbol.dispose](): void {
    this.stopShown();
    for (const conversationId of [...this.posted.keys()])
      this.dismiss(conversationId);
  }

  private post(message: Message): void {
    const kind = Resources.formatQualifiedName(this.context.moduleId, Resources.replyFailedNotice);
    const open = new CommandRun(QualifiedName.parse(Resources.formatQualifiedName(this.context.moduleId, Resources.openChatCommand)),
      { [Resources.openChatIdArgument]: message.conversationId });
    const error = message.details.findLast(t => t.kind === DetailKind.Error)?.text ?? null;
    try {
      this.posted.set(message.conversationId, this.context.postNotification(new NotificationPost(QualifiedName.parse(kind), message.conversationId,
        Resources.formatReplyFailed(message.teammateName), String.isNullOrWhitespace(error) ? null : error, NotificationSeverity.Error, open, [], null)));
    }
    catch (error) {
      this.context.log.write(Resources.formatNoticeNotPosted(kind, CoreResources.formatFailureKind(error)));
    }
  }

  private dismiss(conversationId: string): void {
    this.posted.get(conversationId)?.dismiss();
    this.posted.delete(conversationId);
  }
}
