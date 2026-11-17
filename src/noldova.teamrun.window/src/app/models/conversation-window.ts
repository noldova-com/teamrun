/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";

import type { ConversationHistorySource } from "./conversation-history-source";
import type { MessageIndexEntry } from "./message-index-entry";
import type { ReadingPosition } from "./reading-position";

export class ConversationWindow {
  public readonly conversationId: string;
  public readonly history: WritableSignal<ConversationHistorySource | null> = signal(null);
  public readonly index: WritableSignal<readonly MessageIndexEntry[]> = signal([]);
  public readonly pendingPosition: WritableSignal<ReadingPosition | null> = signal(null);
  public readonly isLoaded: WritableSignal<boolean> = signal(false);
  public holders: number = 0;
  public generation: number = 0;
  public loading: Promise<boolean> | null = null;

  public constructor(conversationId: string) {
    this.conversationId = conversationId;
  }
}
