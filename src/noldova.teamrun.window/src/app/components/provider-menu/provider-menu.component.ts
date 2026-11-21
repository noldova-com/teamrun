/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Component, computed, inject, input, type InputSignal, type Signal } from "@angular/core";

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { AuthStatus, type Provider, ProviderAbility } from "@noldova/teamrun.protocol";
import {
  DialogService,
  IconButtonComponent,
  MenuComponent,
  MenuItemComponent,
  MenuSeparatorComponent,
  MenuTriggerDirective,
  OverlayAlignment,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { AbilityRefusal } from "../../models/ability-refusal";
import type { ChatStoreService } from "../../services/chat-store.service";
import { ProviderEditor } from "../../services/provider-editor";
import { ProviderSignOut } from "../../services/provider-sign-out";

@Component({
  selector: "nol-teamrun-provider-menu",
  imports: [IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, TooltipDirective],
  templateUrl: "./provider-menu.component.html",
  styleUrl: "./provider-menu.component.css"
})
export class ProviderMenuComponent {
  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly provider: InputSignal<Provider> = input.required<Provider>();
  public readonly context: InputSignal<IWindowPartContext> = input.required<IWindowPartContext>();
  public readonly report: InputSignal<(message: string) => void> = input.required<(message: string) => void>();
  public readonly askRemove: InputSignal<(provider: Provider) => void> = input.required<(provider: Provider) => void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly end: OverlayAlignment = OverlayAlignment.End;
  protected readonly signedIn: AuthStatus = AuthStatus.LoggedIn;
  private readonly dialogs: DialogService = inject(DialogService);
  protected readonly signOutRefusal: Signal<string | null> = computed(() => {
    const store = this.store();
    const provider = this.provider();
    return provider.enabled && provider.authStatus === AuthStatus.LoggedIn && !store.canSignOut(provider)
      ? AbilityRefusal.of(store.kinds().find(t => t.id === provider.kind), ProviderAbility.SignOut, Resources.signOutAction) : null;
  });

  protected edit(): void {
    ProviderEditor.open(this.dialogs, this.store(), this.context(), this.provider());
  }

  protected async showFolder(): Promise<void> {
    await this.context().showInFolderAsync(this.provider().profileDir)
      .catch((error: unknown) => this.report()(Resources.formatProfileFolderNotShown(error instanceof Error ? error.message : String(error))));
  }

  protected async signOut(): Promise<void> {
    const provider = this.provider();
    if (await ProviderSignOut.confirmAsync(this.dialogs, this.store(), provider, this.report()))
      await ProviderSignOut.signOutAsync(this.store(), provider, this.report());
  }

  protected remove(): void {
    this.askRemove()(this.provider());
  }
}
