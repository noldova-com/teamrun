/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component,
  ElementRef,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild
} from "@angular/core";

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { AuthStatus, Harness, NameOrder, type Provider, type Teammate, TeammateCreateParams, TeammateName } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, DialogService, FieldMessageComponent, SelectComponent, SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { ChatStoreService } from "../../services/chat-store.service";
import { ConversationActions } from "../../services/conversation-actions";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";

@Component({
  selector: "nol-teamrun-first-teammate",
  imports: [ButtonComponent, FieldMessageComponent, SelectComponent, TextFieldComponent],
  templateUrl: "./first-teammate.component.html",
  styleUrls: ["../settings-dialog.css", "./first-teammate.component.css"]
})
export class FirstTeammateComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly context: InputSignal<IWindowPartContext> = input.required<IWindowPartContext>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  private readonly nameField: Signal<ElementRef<HTMLInputElement>> = viewChild.required("nameField", { read: ElementRef });

  private readonly providers: Signal<readonly Provider[]> = computed(() => {
    const kinds = this.store().kinds();
    return NameOrder.sort(this.store().enabledProviders(), t => kinds.find(u => u.id === t.kind)?.displayName ?? t.kind, t => t.label);
  });
  protected readonly providerId: WritableSignal<string> = linkedSignal(() => untracked(() => FirstTeammateComponent.firstOf(this.store().enabledProviders()))?.id
    ?? String.empty);
  protected readonly name: WritableSignal<string> = linkedSignal(() => {
    const provider = untracked(() => FirstTeammateComponent.firstOf(this.store().enabledProviders()));
    return Object.isUndefined(provider) ? String.empty : Resources.firstTeammateNames.get(provider.kind) ?? provider.label;
  });
  protected readonly providerOptions: Signal<readonly SelectOption[]> = computed(() => {
    const kinds = this.store().kinds();
    return this.providers().map(t => new SelectOption(t.id, Resources.formatProviderChoice(t.label, kinds.find(u => u.id === t.kind)?.displayName ?? t.kind)));
  });
  protected readonly mention: Signal<string> = computed(() => String.isNullOrWhitespace(this.name()) ? String.empty : Resources.formatMention(this.name().trim()));
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly messageId: string = "nol-teamrun-first-teammate-message";
  protected readonly isNameValid: Signal<boolean> = computed(() => FirstTeammateComponent.isValidName(this.name().trim()));
  protected readonly isNameMarked: Signal<boolean> = computed(() => !String.isNullOrWhitespace(this.name()) && !this.isNameValid() || !Object.isNull(this.takenName()));
  private readonly takenName: WritableSignal<string | null> = signal(null);
  private readonly report: (message: string, takenName: string | null) => void = (t, u) => {
    this.error.set(t);
    this.takenName.set(u);
  };
  protected readonly canStart: Signal<boolean> = computed(() => this.isNameValid() && this.providerId().length > 0 && !this.saving());

  protected editName(): void {
    this.error.set(null);
    this.takenName.set(null);
    this.name.set(this.nameField().nativeElement.value);
  }

  protected changeProvider(id: string): void {
    this.providerId.set(id);
  }

  protected chooseNow(): void {
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.store());
    dialog.componentRef?.setInput("first", true);
    dialog.componentRef?.setInput("draftName", this.name().trim());
    dialog.componentRef?.setInput("draftProviderId", this.providerId());
    dialog.componentInstance?.created.subscribe(t => this.startWith(t));
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected async start(event: globalThis.Event): Promise<void> {
    event.preventDefault();
    this.saving.set(true);
    this.error.set(null);
    this.takenName.set(null);
    const teammate = await this.store().createTeammate(new TeammateCreateParams(this.name().trim(), null, this.providerId(), Harness.Provider, null, null, null, null, null),
      this.report);
    this.saving.set(false);
    if (!Object.isNull(teammate))
      this.startWith(teammate);
  }

  protected dismiss(): void {
    this.closed.emit();
  }

  private startWith(teammate: Teammate): void {
    void ConversationActions.start(this.context(), this.store(), null, teammate.id);
    this.closed.emit();
  }

  private static firstOf(providers: readonly Provider[]): Provider | undefined {
    const sorted = providers.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
    return sorted.find(t => t.authStatus === AuthStatus.LoggedIn) ?? sorted[0];
  }

  private static isValidName(name: string): boolean {
    try {
      TeammateName.validate(name);
      return true;
    }
    catch {
      return false;
    }
  }
}
