/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Message } from "@noldova/teamrun.protocol";

export class ChatSpeed {
  public readonly conversationId: string;
  public readonly teammateId: string | null;
  public readonly sequence: number;
  public readonly unavailable: string | null;
  public readonly served: string | null;

  public constructor(conversationId: string, teammateId: string | null, sequence: number, unavailable: string | null, served: string | null = null) {
    this.conversationId = conversationId;
    this.teammateId = teammateId;
    this.sequence = sequence;
    this.unavailable = unavailable;
    this.served = served;
  }

  public static ofMessage(message: Message): ChatSpeed | null {
    const provenance = message.provenance;
    const asked = !Object.isNull(provenance) && !Object.isNull(provenance.requested.speed);
    return Object.isNull(provenance) ? null : new ChatSpeed(message.conversationId, message.teammateId, message.sequence,
      asked ? provenance.observed.speedUnavailable : null, asked ? provenance.observed.speed : null);
  }

  public static merge(all: readonly ChatSpeed[], next: ChatSpeed | null): readonly ChatSpeed[] {
    if (Object.isNull(next))
      return all;
    const same = all.find(t => t.conversationId === next.conversationId && t.teammateId === next.teammateId);
    if (!Object.isUndefined(same) && same.sequence > next.sequence)
      return all;
    return [...all.filter(t => t !== same), next];
  }
}
