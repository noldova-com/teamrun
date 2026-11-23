/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  type InputSignal,
  linkedSignal,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  untracked,
  viewChild,
  type WritableSignal
} from "@angular/core";

import "@noldova/context.core";
import { ProfileFolderName, type ProviderKindInstallation, ProviderKindInstallState } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  DialogService,
  FieldMessageComponent,
  InlineCodeComponent,
  ProgressComponent,
  SpinnerComponent,
  TextFieldComponent
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ProviderKindCard } from "../../models/provider-kind-card";
import { ProviderKindChoices } from "../../models/provider-kind-choices";
import { ProviderWizardRow } from "../../models/provider-wizard-row";
import { TakenKind } from "../../models/taken-kind";
import { AcpAgentsBrowser } from "../../services/acp-agents-browser";
import type { ChatStoreService } from "../../services/chat-store.service";
import { ProviderTerminalComponent } from "../provider-terminal/provider-terminal.component";

@Component({
  selector: "nol-teamrun-provider-add",
  imports: [ButtonComponent, FieldMessageComponent, InlineCodeComponent, ProgressComponent, ProviderTerminalComponent, SpinnerComponent, TextFieldComponent],
  templateUrl: "./provider-add.component.html",
  styleUrls: ["../settings-view.css", "./provider-add.component.css"]
})
export class ProviderAddComponent {
  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly chooseFolder: InputSignal<() => Promise<string | null>> = input.required<() => Promise<string | null>>();
  public readonly closed: OutputEmitterRef<void> = output<void>();
  public readonly chosenKind: OutputEmitterRef<string | null> = output<string | null>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly shownAsId: string = "nol-teamrun-shown-as";
  protected readonly takenKinds: Signal<ReadonlyMap<string, string>> = computed(() => TakenKind.reasons(this.store().kinds(), this.store().providers()));
  protected readonly typeCards: Signal<readonly ProviderKindCard[]> = computed(() => {
    const store = this.store();
    const taken = this.takenKinds();
    return store.kinds().map(t => ProviderAddComponent.cardOf(new ProviderWizardRow(t, store.tools().get(t.id) ?? null, store.installations().get(t.id) ?? null,
      store.providers().filter(u => u.kind === t.id), [], store.toolInstalls().has(t.id)), taken.get(t.id) ?? null));
  });
  protected readonly acpCard: ProviderKindCard = new ProviderKindCard(Resources.acpRowKind, Resources.acpCardName, Resources.acpCardNote, false, null);
  protected readonly cards: Signal<readonly ProviderKindCard[]> = computed(() => [...this.typeCards(), this.acpCard]);
  protected readonly kind: WritableSignal<string> = linkedSignal({
    source: () => new ProviderKindChoices(this.store().kinds().map(t => t.id), this.takenKinds()),
    computation: (source, previous) => TakenKind.firstFree(source.taken, [source.kinds.find(t => t === previous?.value),
      source.kinds.find(t => this.store().terminalSessions().has(t)), ...source.kinds], Resources.acpRowKind)
  });
  protected readonly chosen: Signal<ProviderKindCard> = computed(() => this.typeCards().find(t => t.id === this.kind()) ?? this.acpCard);
  protected readonly edited: WritableSignal<string | null> = signal(null);
  protected readonly label: Signal<string> = computed(() => this.edited()
    ?? Resources.nextProviderName(this.store().providers().filter(t => t.kind === this.kind()).map(t => t.label)));
  protected readonly folder: WritableSignal<string | null> = signal(null);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly installingKind: WritableSignal<string | null> = signal(null);
  protected readonly waitingTool: WritableSignal<ProviderKindCard | null> = signal(null);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly shownAs: Signal<string | null> = computed(() => {
    const card = this.chosen();
    const label = this.label().trim();
    return Object.isNull(card.row) || label.length === 0 ? null : Resources.formatShownAs(label, card.name);
  });
  protected readonly installation: Signal<ProviderKindInstallation | null> = computed(() => this.chosen().row?.installation ?? null);
  protected readonly progress: Signal<ProviderKindInstallation | null> = computed(() => {
    const installation = this.installation();
    return installation?.state === ProviderKindInstallState.Installing ? installation : null;
  });
  protected readonly progressValue: Signal<number | null> = computed(() => {
    const installation = this.progress();
    return Object.isNull(installation) || !installation.cancellable || installation.total === 0 ? null : installation.received / installation.total;
  });
  protected readonly unavailable: Signal<ProviderKindInstallation | null> = computed(() => {
    const installation = this.installation();
    return installation?.state === ProviderKindInstallState.Unavailable ? installation : null;
  });
  protected readonly toolCommand: Signal<string | null> = computed(() => {
    const row = this.chosen().row;
    return Object.isNull(row) || !Object.isNull(row.installation) || row.isInstalled ? null : row.tool?.installCommand ?? null;
  });
  protected readonly lookingAgain: WritableSignal<boolean> = signal(false);
  protected readonly toolSession: Signal<string | null> = computed(() => {
    const session = this.toolTerminal();
    return Object.isUndefined(session) || this.hiddenSessions().has(session) ? null : session;
  });
  protected readonly hiddenToolSession: Signal<string | null> = computed(() => {
    const session = this.toolTerminal();
    return Object.isUndefined(session) || !this.hiddenSessions().has(session) ? null : session;
  });
  protected readonly folderNote: Signal<string> = computed(() => {
    const folder = this.folder();
    return Object.isNull(folder) ? Resources.newFolderNote : Resources.formatExistingFolderNote(folder);
  });
  protected readonly addLabel: Signal<string> = computed(() => Object.isNull(this.folder()) && this.chosen().row?.kind.supportsSignIn === true
    ? Resources.addAndSignInLabel : Resources.addOnlyLabel);
  protected readonly busy: Signal<boolean> = computed(() => this.saving() || !Object.isNull(this.installingKind()) || !Object.isNull(this.waitingTool()));
  protected readonly canAdd: Signal<boolean> = computed(() => {
    const label = this.label().trim();
    return !this.saving() && Object.isNull(this.installingKind()) && Object.isNull(this.waitingTool())
      && !Object.isNull(this.chosen().row) && Object.isNull(this.unavailable()) && Object.isNull(this.progress()) && !this.store().isBusy()
      && (Object.isNull(this.folder()) ? !Object.isNull(ProfileFolderName.of(label)) : label.length > 0);
  });

  private readonly dialogs: DialogService = inject(DialogService);
  private readonly showError: (message: string) => void = message => this.error.set(message);
  private readonly hiddenSessions: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly labelField: Signal<ElementRef<HTMLInputElement>> = viewChild.required("labelField", { read: ElementRef });
  private dropped: boolean = false;
  private readonly toolTerminal: Signal<string | undefined> = computed(() => {
    return this.store().terminalSessions().get(this.kind());
  });

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.dropped = true;
    });
    effect(() => {
      const kind = this.kind();
      untracked(() => this.chosenKind.emit(kind));
    });
    effect(() => {
      const card = this.waitingTool();
      if (Object.isNull(card))
        return;
      const kind = card.id;
      const store = this.store();
      const found = store.tools().get(kind)?.found === true;
      if (!found && store.toolInstalls().has(kind))
        return;
      const ended = store.terminalSessions().has(kind);
      untracked(() => {
        this.waitingTool.set(null);
        if (found)
          void this.save(kind);
        else if (ended)
          this.error.set(Resources.formatToolInstallFailed(card.name));
      });
    });
  }

  protected choose(card: ProviderKindCard): void {
    this.error.set(null);
    if (card.id !== Resources.acpRowKind) {
      this.kind.set(card.id);
      return;
    }
    const store = this.store();
    const earlier = new Set(store.kinds().map(t => t.id));
    const browser = AcpAgentsBrowser.open(this.dialogs, store);
    const list = browser.componentInstance;
    browser.closed.subscribe(() => void list?.settled().then(() => {
      const added = store.kinds().findLast(t => !earlier.has(t.id));
      if (!Object.isUndefined(added))
        this.kind.set(added.id);
    }));
  }

  protected editLabel(): void {
    this.edited.set(this.labelField().nativeElement.value);
  }

  protected async pickFolder(): Promise<void> {
    const folder = await this.chooseFolder()();
    if (!Object.isNull(folder))
      this.folder.set(folder);
  }

  protected async add(): Promise<void> {
    const card = this.chosen();
    if (!this.canAdd())
      return;
    const kind = card.id;
    this.error.set(null);
    if (this.installation()?.state === ProviderKindInstallState.NotInstalled)
      await this.install(kind);
    else if (!Object.isNull(this.toolCommand()))
      this.installTool(card);
    else
      await this.save(kind);
  }

  protected async tryAgain(kind: string): Promise<void> {
    this.error.set(null);
    await this.install(kind);
  }

  protected cancelInstall(kind: string): void {
    this.error.set(null);
    void this.store().cancelInstall(kind, this.showError);
  }

  protected async lookAgain(): Promise<void> {
    this.error.set(null);
    this.lookingAgain.set(true);
    await this.store().refreshTools(this.showError);
    this.lookingAgain.set(false);
  }

  protected hideTerminal(session: string): void {
    this.hiddenSessions.update(t => new Set([...t, session]));
  }

  protected showTerminal(session: string): void {
    this.hiddenSessions.update(t => new Set([...t].filter(u => u !== session)));
  }

  protected close(): void {
    if (this.saving())
      return;
    this.dropped = true;
    this.closed.emit();
  }

  private async install(kind: string): Promise<void> {
    if (!Object.isNull(this.installingKind()))
      return;
    const store = this.store();
    this.installingKind.set(kind);
    await store.installKind(kind, this.showError);
    this.installingKind.set(null);
    if (this.dropped)
      return;
    const installation = store.installations().get(kind);
    if (installation?.state === ProviderKindInstallState.Installed)
      await this.save(kind);
    else if (installation?.state === ProviderKindInstallState.NotInstalled && !Object.isNull(installation.reason))
      this.error.set(installation.reason);
    else if (installation?.state === ProviderKindInstallState.Unavailable)
      this.error.set(null);
  }

  private installTool(card: ProviderKindCard): void {
    void this.store().installTool(card.id, this.showError, false);
    this.waitingTool.set(card);
  }

  private async save(kind: string): Promise<void> {
    this.saving.set(true);
    const saved = await this.store().addProvider(kind, this.label().trim(), this.folder(), this.showError, false);
    this.saving.set(false);
    if (saved)
      this.closed.emit();
  }

  private static cardOf(row: ProviderWizardRow, takenReason: string | null): ProviderKindCard {
    const installation = row.installation;
    const name = row.kind.displayName;
    if (!Object.isNull(takenReason))
      return new ProviderKindCard(row.kind.id, name, takenReason, false, row, takenReason);
    if (row.isInstalling)
      return new ProviderKindCard(row.kind.id, name, Resources.kindInstallingNote, false, row);
    if (installation?.state === ProviderKindInstallState.Unavailable)
      return new ProviderKindCard(row.kind.id, name, Resources.formatKindUnavailableNote(installation.missingTool), true, row);
    if (row.isInstalled)
      return new ProviderKindCard(row.kind.id, name, Resources.formatKindInstalledNote(installation?.version ?? row.tool?.version ?? null), false, row);
    if (!Object.isNull(installation))
      return new ProviderKindCard(row.kind.id, name, Resources.kindOwnInstallNote, false, row);
    return new ProviderKindCard(row.kind.id, name, Object.isNullOrUndefined(row.tool?.installCommand) ? Resources.kindMissingNote : Resources.kindToolInstallNote, false,
      row);
  }
}
