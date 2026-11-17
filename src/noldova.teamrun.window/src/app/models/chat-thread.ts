/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Message } from "@noldova/teamrun.protocol";

export class ChatThread {
  public readonly conversationId: string;
  public readonly teammateId: string | null;
  public readonly sequence: number;
  public readonly kind: string;
  public readonly providerId: string | null;
  public readonly model: string;
  public readonly effort: string | null;

  public constructor(conversationId: string, teammateId: string | null, sequence: number, kind: string, providerId: string | null, model: string, effort: string | null) {
    this.conversationId = conversationId;
    this.teammateId = teammateId;
    this.sequence = sequence;
    this.kind = kind;
    this.providerId = providerId;
    this.model = model;
    this.effort = effort;
  }

  public static ofMessage(message: Message): ChatThread | null {
    const provenance = message.provenance;
    const model = provenance?.observed.model ?? null;
    return Object.isNull(provenance) || Object.isNull(provenance.nativeSessionId) || Object.isNull(model) ? null
      : new ChatThread(message.conversationId, message.teammateId, message.sequence, provenance.requested.kind, provenance.providerId, model, provenance.observed.effort);
  }

  public static merge(all: readonly ChatThread[], next: ChatThread | null): readonly ChatThread[] {
    if (Object.isNull(next))
      return all;
    const same = all.find(t => t.conversationId === next.conversationId && t.teammateId === next.teammateId && t.kind === next.kind && t.providerId === next.providerId);
    if (!Object.isUndefined(same) && same.sequence > next.sequence)
      return all;
    return [...all.filter(t => t !== same), next];
  }
}
