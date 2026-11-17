/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Component, computed, inject, input, type InputSignal, output, type OutputEmitterRef, type Signal } from "@angular/core";
import "@noldova/context.core";
import { type Provider } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, ClipboardWriter, LinkOpenEvent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { ChatStoreService } from "../../services/chat-store.service";

@Component({
  selector: "nol-teamrun-provider-step",
  imports: [ButtonComponent],
  templateUrl: "./provider-step.component.html",
  styleUrl: "./provider-step.component.css"
})
export class ProviderStepComponent {
  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly provider: InputSignal<Provider> = input.required<Provider>();
  public readonly report: InputSignal<(message: string) => void> = input.required<(message: string) => void>();
  public readonly terminalShown: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly clipboard: ClipboardWriter | null = inject(ClipboardWriter, { optional: true });
  protected readonly needsSignIn: Signal<boolean> = computed(() => {
    const store = this.store();
    const provider = this.provider();
    return provider.enabled && Resources.signInStatuses.includes(provider.authStatus) && !store.signingIn().has(provider.id) &&
      !store.terminalSignIns().has(provider.id) && !store.terminalSignOuts().has(provider.id) && store.canSignIn(provider) && store.hasServer(provider);
  });

  protected readonly signInLabel: Signal<string> = computed(() => {
    const provider = this.provider();
    return Object.isNull(provider.lastError) && !this.store().unfinishedSignIns().has(provider.id) && !Resources.signInAgainStatuses.includes(provider.authStatus)
      ? Resources.signInLabel : Resources.signInAgainLabel;
  });

  protected async openSignInLink(event: MouseEvent, providerId: string, link: string): Promise<void> {
    if (event.type === Resources.auxclickEventName && event.button !== Resources.middleButton)
      return;
    await this.store().openSignInLink(providerId, new LinkOpenEvent(link, event).gesture, this.report());
  }

  protected async copyLink(clipboard: ClipboardWriter, link: string): Promise<void> {
    if (!await clipboard.writeTextAsync(link))
      this.report()(Resources.signInLinkNotCopied);
  }
}
