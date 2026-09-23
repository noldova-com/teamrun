/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, signal } from "@angular/core";
import type { MessageAttachment } from "@noldova/teamrun-protocol";

@Injectable({ providedIn: "root" })
export class DraftService {
  private readonly pendingSignal: WritableSignal<string | null> = signal(null);
  private readonly attachmentsSignal: WritableSignal<readonly MessageAttachment[]> = signal([]);

  public readonly pending: Signal<string | null> = this.pendingSignal.asReadonly();
  public readonly attachments: Signal<readonly MessageAttachment[]> = this.attachmentsSignal.asReadonly();

  public offer(text: string, attachments: readonly MessageAttachment[] = []): void {
    this.attachmentsSignal.set([...attachments]);
    this.pendingSignal.set(text);
  }

  public clear(): void {
    this.pendingSignal.set(null);
    this.attachmentsSignal.set([]);
  }
}
