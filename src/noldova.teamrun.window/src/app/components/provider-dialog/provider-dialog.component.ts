/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked
} from "@angular/core";

import "@noldova/context.core";
import { ProfileFolderName, type Provider, type ProviderProfile } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  DialogComponent,
  DialogDescriptionDirective,
  DialogService,
  FieldMessageComponent,
  IconButtonComponent,
  InlineCodeComponent,
  LinkOpenEvent,
  RadioComponent,
  RadioGroupComponent,
  SelectComponent,
  SelectOption,
  TextFieldComponent
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ProviderWizardRow } from "../../models/provider-wizard-row";
import { TakenKind } from "../../models/taken-kind";
import { AcpAgentsBrowser } from "../../services/acp-agents-browser";
import type { ChatStoreService } from "../../services/chat-store.service";

@Component({
  selector: "nol-teamrun-provider-dialog",
  imports: [ButtonComponent, DialogComponent, DialogDescriptionDirective, FieldMessageComponent, IconButtonComponent, InlineCodeComponent, NgTemplateOutlet, RadioComponent, RadioGroupComponent, SelectComponent,
    TextFieldComponent],
  templateUrl: "./provider-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class ProviderDialogComponent {
  private readonly dialogs: DialogService = inject(DialogService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly newFolderChoice: string = "new";
  protected readonly existingFolderChoice: string = "existing";
  protected readonly hintId: string = "nol-teamrun-profile-hint";
  protected readonly nameMessageId: string = "nol-teamrun-name-message";
  protected readonly binaryHintId: string = "nol-teamrun-binary-path-hint";

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly chooseFolder: InputSignal<() => Promise<string | null>> = input.required<() => Promise<string | null>>();
  public readonly provider: InputSignal<Provider | null> = input<Provider | null>(null);
  public readonly startingKind: InputSignal<string | null> = input<string | null>(null);
  public readonly platform: InputSignal<string> = input<string>(navigator.platform);
  public readonly closed: OutputEmitterRef<void> = output<void>();

  protected readonly takenKinds: Signal<ReadonlyMap<string, string>> = computed(() => Object.isNull(this.provider()) ? TakenKind.reasons(this.store().kinds(),
    this.store().providers()) : new Map());
  protected readonly kind: WritableSignal<string> = linkedSignal({
    source: () => ({ provider: this.provider(), starting: this.startingKind(), kinds: this.store().kinds().map(t => t.id), taken: this.takenKinds() }),
    computation: (source, previous) => {
      if (!Object.isNull(source.provider))
        return source.provider.kind;
      const value = previous?.source.starting === source.starting ? previous.value : null;
      const kept = source.kinds.find(t => t === value);
      return TakenKind.firstFree(source.taken, [kept, source.starting, ...source.kinds], Resources.acpRowKind);
    }
  });
  protected readonly typeKind: Signal<string> = computed(() => this.kind() === Resources.acpRowKind ? String.empty : this.kind());
  protected readonly label: WritableSignal<string> = linkedSignal(() => this.provider()?.label ?? String.empty);
  protected readonly profileDir: WritableSignal<string> = linkedSignal(() => this.provider()?.profileDir ?? String.empty);
  protected readonly binaryPath: WritableSignal<string> = linkedSignal(() => this.provider()?.binaryPath ?? String.empty);
  protected readonly folderChoice: WritableSignal<string | null> = signal(this.newFolderChoice);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly dataFolder: WritableSignal<string | null> = signal(null);

  protected readonly title: Signal<string> = computed(() => Object.isNull(this.provider()) ? Resources.addProviderLabel : Resources.editProviderLabel);
  protected readonly hint: Signal<string> = computed(() => Object.isNull(this.provider()) ? Resources.addProviderHint : Resources.editProviderHint);
  protected readonly saveLabel: Signal<string> = computed(() => Object.isNull(this.provider()) ? Resources.addProviderLabel : Resources.saveLabel);
  protected readonly kindOptions: Signal<readonly SelectOption[]> = computed(() => [...this.store().kinds().map(t => new SelectOption(t.id, t.displayName, null,
    this.takenKinds().has(t.id))),
    ...Object.isNull(this.provider()) ? [new SelectOption(Resources.acpRowKind, Resources.acpKindOption)] : []]);
  protected readonly choosesServerPath: Signal<boolean> = computed(() =>
    !Object.isNull(this.provider()) && this.store().kinds().some(t => t.id === this.kind() && t.choosesServerPath));
  protected readonly makesFolder: Signal<boolean> = computed(() => Object.isNull(this.provider()) && this.folderChoice() === this.newFolderChoice);
  protected readonly folderName: Signal<string | null> = computed(() => ProfileFolderName.of(this.label().trim()));
  protected readonly sharesSignIn: Signal<boolean> = computed(() =>
    !Object.isNullOrUndefined(this.store().kinds().find(t => t.id === this.kind())?.singleAccount));
  protected readonly kindHint: Signal<string> = computed(() => Resources.profileHintFor(this.typeKind(), this.sharesSignIn(),
    this.platform().startsWith(Resources.windowsPlatformPrefix)));
  protected readonly namelessLabel: Signal<string | null> = computed(() => {
    const label = this.label().trim();
    return Object.isNull(this.provider()) && label.length > 0 && Object.isNull(this.folderName()) ? Resources.formatNewFolderNameless(label) : null;
  });
  protected readonly namelessReason: Signal<string | null> = computed(() => this.makesFolder() ? this.namelessLabel() : null);
  protected readonly folderHint: Signal<string> = computed(() => {
    const name = this.folderName();
    const kind = this.typeKind();
    if (kind.length === 0)
      return Resources.profileHintFor(kind);

    return Object.isNull(name) ? Resources.newFolderUnnamedHint : Resources.formatNewFolder(this.dataFolder(), kind, name);
  });
  protected readonly signInCommand: Signal<ProviderProfile | null> = computed(() => {
    const kind = this.store().kinds().find(t => t.id === this.kind());
    const profile = kind?.supportsSignIn === false ? kind.profile : null;
    return Object.isNull(profile) || Object.isNull(profile.signInCommand) ? null : profile;
  });
  protected readonly signInText: Signal<string> = computed(() => {
    const store = this.store();
    const kind = store.kinds().find(t => t.id === this.kind());
    if (Object.isUndefined(kind))
      return String.empty;
    if (kind.supportsSignIn)
      return Resources.hintSeparator + (store.isInstalled(kind.id) ? Resources.newFolderSignInHint : Resources.newFolderInstallHint);

    return Resources.hintSeparator + Resources.newFolderOwnSignInHint;
  });
  protected readonly install: Signal<ProviderWizardRow | null> = computed(() => {
    const store = this.store();
    const kind = store.kinds().find(t => t.id === this.kind());
    return Object.isUndefined(kind) || !Object.isNull(this.provider()) ? null : new ProviderWizardRow(kind, store.tools().get(kind.id) ?? null,
      store.installations().get(kind.id) ?? null, store.providers().filter(t => t.kind === kind.id), [], store.toolInstalls().has(kind.id));
  });
  protected readonly kindRefusal: Signal<string | null> = computed(() => [...this.takenKinds().values()].join(" ") || null);
  protected readonly canSave: Signal<boolean> = computed(() => !this.saving() && this.typeKind().length > 0 && !String.isNullOrWhitespace(this.label())
    && (this.makesFolder() ? !Object.isNull(this.folderName()) : !String.isNullOrWhitespace(this.profileDir())));

  public constructor() {
    effect(() => {
      const store = this.store();
      if (Object.isNull(this.provider()))
        untracked(() => void store.readDataFolder().then(t => this.dataFolder.set(t.path), () => undefined));
    });
  }

  protected chooseKind(kind: string): void {
    if (kind !== Resources.acpRowKind) {
      this.kind.set(kind);
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

  protected installKind(row: ProviderWizardRow): void {
    this.error.set(null);
    const report = (message: string): void => this.error.set(message);
    if (!Object.isNull(row.installation)) {
      void this.store().installKind(row.kind.id, report);
      return;
    }
    void this.store().installTool(row.kind.id, report);
    this.closed.emit();
  }

  protected cancelInstall(row: ProviderWizardRow): void {
    this.error.set(null);
    void this.store().cancelInstall(row.kind.id, t => this.error.set(t));
  }

  protected subscribe(event: MouseEvent, url: string): void {
    if (event.type === Resources.auxclickEventName && event.button !== Resources.middleButton)
      return;
    this.error.set(null);
    const opened = new LinkOpenEvent(url, event);
    void this.store().openPage(opened.url, opened.gesture, t => this.error.set(t));
  }

  protected editLabel(event: globalThis.Event): void {
    if (event.target instanceof HTMLInputElement)
      this.label.set(event.target.value);
  }

  protected editProfileDir(event: globalThis.Event): void {
    if (event.target instanceof HTMLInputElement)
      this.profileDir.set(event.target.value);
  }

  protected editBinaryPath(event: globalThis.Event): void {
    if (event.target instanceof HTMLInputElement)
      this.binaryPath.set(event.target.value);
  }

  protected async pickProfile(): Promise<void> {
    const folder = await this.chooseFolder()();
    if (!Object.isNull(folder))
      this.profileDir.set(folder);
  }

  protected dismiss(): void {
    if (!this.saving())
      this.closed.emit();
  }

  protected async save(event: globalThis.Event): Promise<void> {
    event.preventDefault();
    if (!this.canSave())
      return;

    this.saving.set(true);
    this.error.set(null);
    const store = this.store();
    const provider = this.provider();
    const report = (message: string): void => this.error.set(message);
    const binaryPath = this.binaryPath().trim();
    const saved = await (Object.isNull(provider)
      ? store.addProvider(this.kind(), this.label().trim(), this.makesFolder() ? null : this.profileDir().trim(), report)
      : store.updateProvider(provider.id, this.label().trim(), this.profileDir().trim(), this.choosesServerPath() ? binaryPath : null, report));
    this.saving.set(false);
    if (saved)
      this.closed.emit();
  }
}
