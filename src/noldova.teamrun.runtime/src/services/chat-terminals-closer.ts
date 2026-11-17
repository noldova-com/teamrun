/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IEventListener, type ILog, Resources as CoreResources } from "@noldova/teamrun.core";
import { ConversationIdParams, type Event, EventName, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import type { RuntimeTerminalOwners } from "@noldova/terminal.protocol";

import { Resources } from "../resources.js";

export class ChatTerminalsCloser implements IEventListener {
  private readonly owners: () => RuntimeTerminalOwners;
  private readonly log: ILog;

  public constructor(owners: () => RuntimeTerminalOwners, log: ILog) {
    this.owners = owners;
    this.log = log;
  }

  public onEvent(event: Event): void {
    if (event.name === EventName.ConversationDeleted)
      void this.closeAsync(ConversationIdParams.fromJson(event.payload).conversationId);
  }

  private async closeAsync(conversationId: string): Promise<void> {
    try {
      await this.owners().closeAsync(`${ProtocolResources.chatTerminalOwnerPrefix}${conversationId}`);
    }
    catch (error) {
      this.log.write(Resources.formatChatTerminalsNotClosed(conversationId, CoreResources.formatFailureKind(error)));
    }
  }
}
