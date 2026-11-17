/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, effect, inject, untracked } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { ButtonComponent, ButtonVariant, ChipComponent, ChipKind } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { KeyHint } from "../../models/key-hint";
import { ChatStoreService } from "../../services/chat-store.service";
import { ConversationActions } from "../../services/conversation-actions";

@Component({
  selector: "nol-teamrun-conversation-placeholder",
  imports: [ButtonComponent, ChipComponent],
  providers: [ChatStoreService.provider],
  templateUrl: "./conversation-placeholder.component.html",
  styleUrl: "./conversation-placeholder.component.css"
})
export class ConversationPlaceholderComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly key: ChipKind = ChipKind.Key;
  protected readonly hints: readonly KeyHint[] = ConversationPlaceholderComponent.hintsFor(navigator.platform.startsWith(Resources.macPlatformPrefix));
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private hasOffered: boolean = false;

  public constructor() {
    effect(() => {
      if (!this.store.loaded() || this.hasOffered)
        return;
      this.hasOffered = true;
      untracked(() => void this.offerFirstLaunch());
    });
  }

  protected addProvider(): void {
    this.context.openDocument(Resources.providersDocumentName, Resources.providersDocumentInstance, Resources.providersTitle);
  }

  protected startChat(): Promise<unknown> {
    return ConversationActions.start(this.context, this.store, this.store.selectedProjectId());
  }

  protected openFolder(): Promise<void> {
    return ConversationActions.openProject(this.context, this.store);
  }

  private static hintsFor(isMac: boolean): readonly KeyHint[] {
    return [
      KeyHint.of(Resources.newConversationLabel, Resources.newConversationKey, isMac),
      KeyHint.of(Resources.openFolderLabel, Resources.openProjectKey, isMac)
    ];
  }

  private async offerFirstLaunch(): Promise<void> {
    if (this.store.providers().length > 0)
      return;
    const firstLaunch = await this.store.readFirstLaunch(() => this.offerFirstLaunch());
    if (Object.isNull(firstLaunch) || firstLaunch.isFinished || this.store.providers().length > 0)
      return;
    this.store.welcome();
    this.addProvider();
  }
}
