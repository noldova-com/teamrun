/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type OutputEmitterRef, type Signal, type WritableSignal, computed, input, output, signal }
  from "@angular/core";

import "@noldova/context.core";
import { type Message, MessageAuthor, ProviderAbility } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CheckboxComponent, DialogComponent, DialogDescriptionDirective, FieldMessageComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { AbilityRefusal } from "../../models/ability-refusal";
import type { ChatStoreService } from "../../services/chat-store.service";

@Component({
  selector: "nol-teamrun-rewind-dialog",
  imports: [ButtonComponent, CheckboxComponent, DialogComponent, DialogDescriptionDirective, FieldMessageComponent],
  templateUrl: "./rewind-dialog.component.html",
  styleUrls: ["../settings-dialog.css", "./rewind-dialog.component.css"]
})
export class RewindDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly message: InputSignal<Message> = input.required<Message>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  protected readonly restoreFiles: WritableSignal<boolean> = signal(true);
  protected readonly rewinding: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly forkUnavailable: Signal<string | null> = computed(() => {
    const target = this.message();
    const store = this.store();
    const history = store.historyOf(target.conversationId);
    const held: readonly Message[] = Object.isNull(history) || Object.isNull(history.find(target.id)) ? [] : history.held;
    const kept = held.findLast(t => t.sequence < target.sequence && t.author === MessageAuthor.Provider && Object.isNull(t.teammateId));
    const kind = store.kinds().find(t => t.id === kept?.provenance?.requested.kind);
    if (Object.isUndefined(kind) || kind.supportsFork)
      return null;
    const refusal = AbilityRefusal.of(kind, ProviderAbility.Fork, Resources.rewindWithinSessionAction);
    return Object.isNull(refusal) ? Resources.formatForkUnavailable(kind.displayName) : Resources.formatForkRefused(refusal);
  });

  protected dismiss(): void {
    if (!this.rewinding())
      this.closed.emit();
  }

  protected async rewind(event: globalThis.Event): Promise<void> {
    event.preventDefault();
    if (this.rewinding())
      return;

    this.rewinding.set(true);
    this.error.set(null);
    const store = this.store();
    const result = await store.rewind(this.message(), this.restoreFiles(), t => this.error.set(t));
    this.rewinding.set(false);
    if (!Object.isNull(result))
      this.closed.emit();
  }
}
