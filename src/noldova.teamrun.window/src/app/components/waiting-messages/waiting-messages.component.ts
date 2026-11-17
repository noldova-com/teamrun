/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, input, type InputSignal, output, type OutputEmitterRef, type Signal } from "@angular/core";
import "@noldova/context.core";
import { MessageDelivery, ProviderAbility, type WaitingMessage } from "@noldova/teamrun.protocol";
import {
  ChipComponent,
  ChipKind,
  IconButtonComponent,
  MenuComponent,
  MenuItemComponent,
  MenuSeparatorComponent,
  MenuTriggerDirective,
  OverlayAlignment,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { AbilityRefusal } from "../../models/ability-refusal";
import { ChatStoreService } from "../../services/chat-store.service";
import { Resources } from "../../../resources";

@Component({
  selector: "nol-teamrun-waiting-messages",
  imports: [ChipComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, TooltipDirective],
  templateUrl: "./waiting-messages.component.html",
  styleUrl: "./waiting-messages.component.css"
})
export class WaitingMessagesComponent {
  public readonly chatId: InputSignal<string | null> = input.required<string | null>();
  public readonly editable: InputSignal<boolean> = input(true);
  public readonly edit: OutputEmitterRef<WaitingMessage> = output<WaitingMessage>();

  protected readonly store: ChatStoreService = inject(ChatStoreService);
  protected readonly resources: typeof Resources = Resources;
  protected readonly end: OverlayAlignment = OverlayAlignment.End;
  protected readonly messages: Signal<readonly WaitingMessage[]> = computed(() => this.store.waitingOf(this.chatId()));
  protected readonly steerRefusal: Signal<string | null> = computed(() => {
    const reply = this.store.runningReplyOf(this.chatId());
    return Object.isNull(reply) ? null : AbilityRefusal.of(this.store.kinds().find(t => t.id === reply.provenance?.requested.kind), ProviderAbility.SteerTurn,
      Resources.steerTurnAction);
  });

  protected kindOf(waiting: WaitingMessage): ChipKind {
    return Object.isNull(waiting.failure) ? ChipKind.Status : ChipKind.Failed;
  }

  protected firstLineOf(waiting: WaitingMessage): string {
    return waiting.message.text.split(Resources.lineSeparator).find(t => !String.isNullOrWhitespace(t))?.trim() ?? Resources.formatFileCount(waiting.message.attachments.length);
  }

  protected noteOf(waiting: WaitingMessage): string | null {
    if (!Object.isNull(waiting.failure))
      return waiting.failure;
    const refusal = this.steerRefusal();
    return waiting.delivery === MessageDelivery.Steer && !Object.isNull(refusal) ? Resources.formatSteerWaits(refusal) : null;
  }

  protected sendNow(waiting: WaitingMessage): void {
    void this.store.sendWaitingNow(waiting);
  }

  protected remove(waiting: WaitingMessage): void {
    void this.store.removeWaiting(waiting);
  }
}
