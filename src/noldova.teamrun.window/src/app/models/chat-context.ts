/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { ContextUsage, Message, TeammateUsage } from "@noldova/teamrun.protocol";

export class ChatContext {
  public readonly conversationId: string;
  public readonly teammateId: string | null;
  public readonly messageId: string;
  public readonly startedAt: string | null;
  public readonly context: ContextUsage;
  public readonly providerId: string | null;

  public constructor(conversationId: string, teammateId: string | null, messageId: string, startedAt: string | null, context: ContextUsage,
    providerId: string | null) {
    this.conversationId = conversationId;
    this.teammateId = teammateId;
    this.messageId = messageId;
    this.startedAt = startedAt;
    this.context = context;
    this.providerId = providerId;
  }

  public static ofMessage(message: Message): ChatContext | null {
    const provenance = message.provenance;
    const context = provenance?.usage?.context ?? null;
    return Object.isNull(provenance) || Object.isNull(context) ? null
      : new ChatContext(message.conversationId, message.teammateId, message.id, message.startedAt, context, provenance.providerId);
  }

  public static ofTeammate(usage: TeammateUsage, providerId: string | null): ChatContext | null {
    return Object.isNull(usage.usage.context) ? null
      : new ChatContext(usage.conversationId, usage.teammateId, usage.messageId, usage.startedAt, usage.usage.context, providerId);
  }

  public static merge(all: readonly ChatContext[], next: ChatContext | null): readonly ChatContext[] {
    if (Object.isNull(next))
      return all;
    const same = all.find(t => t.conversationId === next.conversationId && t.teammateId === next.teammateId);
    if (!Object.isUndefined(same) && same.messageId !== next.messageId && (same.startedAt ?? String.empty) > (next.startedAt ?? String.empty))
      return all;
    return [...all.filter(t => t !== same), next];
  }
}
