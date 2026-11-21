/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  type InputSignal,
  type OnInit,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from "@angular/core";

import "@noldova/context.core";
import { type AcpAgentEntry, type AcpAgentListing, type ProviderKindInstallation, ProviderKindInstallState } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  DialogComponent,
  DialogDescriptionDirective,
  DialogSize,
  FieldMessageComponent,
  LinkOpenEvent,
  TextFieldComponent
} from "@noldova/ui.components.angular";

import { ChatAction } from "../../enums/chat-action";
import { AcpLocalVariable } from "../../models/acp-local-variable";
import type { ChatStoreService } from "../../services/chat-store.service";
import { Resources } from "../../../resources";

@Component({
  selector: "nol-teamrun-acp-agents-dialog",
  imports: [ButtonComponent, DialogComponent, DialogDescriptionDirective, FieldMessageComponent, TextFieldComponent],
  templateUrl: "./acp-agents-dialog.component.html",
  styleUrl: "./acp-agents-dialog.component.css"
})
export class AcpAgentsDialogComponent implements OnInit {
  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly large: DialogSize = DialogSize.Large;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly listing: WritableSignal<AcpAgentListing | null> = signal(null);
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly icons: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  protected readonly working: WritableSignal<ReadonlySet<string>> = signal(new Set());
  protected readonly formOpen: WritableSignal<boolean> = signal(false);
  protected readonly name: WritableSignal<string> = signal(String.empty);
  protected readonly command: WritableSignal<string> = signal(String.empty);
  protected readonly argumentLines: WritableSignal<string> = signal(String.empty);
  protected readonly variables: WritableSignal<readonly AcpLocalVariable[]> = signal([]);
  protected readonly visible: Signal<readonly AcpAgentEntry[]> = computed(() => {
    const words = this.query().trim().toLowerCase();
    return (this.listing()?.agents ?? []).filter(t => words.length === 0 || t.name.toLowerCase().includes(words) || t.description.toLowerCase().includes(words));
  });

  private readonly report: (message: string) => void = t => this.error.set(t);
  private readonly pending: Set<Promise<void>> = new Set();
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly added: WritableSignal<string | null> = signal(null);

  public constructor() {
    effect(() => {
      const id = this.added();
      if (Object.isNull(id))
        return;
      const installing = this.store().installations().get(id)?.state === ProviderKindInstallState.Installing;
      untracked(() => {
        this.keepFocus(id);
        if (!installing)
          this.added.set(null);
      });
    });
  }

  public ngOnInit(): void {
    void this.load();
  }

  public async settled(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }

  protected edit(field: WritableSignal<string>, event: Event): void {
    field.set((event.target as HTMLInputElement).value);
  }

  protected masks(icon: string): boolean {
    return icon.startsWith(Resources.acpMaskedIconPrefix);
  }

  protected letterOf(agent: AcpAgentEntry): string {
    return agent.name.trim().charAt(0).toUpperCase();
  }

  protected about(event: MouseEvent, page: string): void {
    if (event.type === Resources.auxclickEventName && event.button !== Resources.middleButton)
      return;
    this.error.set(null);
    const opened = new LinkOpenEvent(page, event);
    void this.store().openPage(opened.url, opened.gesture, this.report);
  }

  protected async add(agent: AcpAgentEntry): Promise<void> {
    await this.work(agent.id, () => this.store().addAcpAgent(agent.id, this.reportOf(ChatAction.AddAcpAgent, agent.id, agent.name)));
    this.added.set(agent.id);
  }

  protected installingOf(agent: AcpAgentEntry): ProviderKindInstallation | null {
    const installation = this.store().installations().get(agent.id);
    return installation?.state === ProviderKindInstallState.Installing ? installation : null;
  }

  protected cancelInstall(agent: AcpAgentEntry): void {
    this.error.set(null);
    void this.store().cancelInstall(agent.id, this.report);
  }

  protected async remove(agent: AcpAgentEntry): Promise<void> {
    await this.work(agent.id, () => this.store().removeAcpAgent(agent.id, this.reportOf(ChatAction.RemoveAcpAgent, agent.id, agent.name)));
    this.keepFocus(agent.id);
  }

  protected addVariable(): void {
    this.variables.update(t => [...t, new AcpLocalVariable(String.empty, String.empty)]);
  }

  protected removeVariable(index: number): void {
    this.variables.update(t => t.filter((_, position) => position !== index));
  }

  protected editVariableName(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.variables.update(t => t.map((u, position) => position === index ? new AcpLocalVariable(value, u.value) : u));
  }

  protected editVariableValue(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.variables.update(t => t.map((u, position) => position === index ? new AcpLocalVariable(u.name, value) : u));
  }

  protected async addLocal(event: Event): Promise<void> {
    event.preventDefault();
    const refusal = this.refusal();
    if (!Object.isNull(refusal)) {
      this.error.set(refusal);
      return;
    }
    const args = this.argumentLines().split(Resources.acpArgumentLineSeparator).map(t => t.trim()).filter(t => t.length > 0);
    await this.work(Resources.acpLocalFormKey, async () => {
      if (await this.store().addLocalAcpCommand(this.name().trim(), this.command().trim(), args, this.variables(), this.reportOf(ChatAction.AddAcpAgent, this.name().trim(), this.name().trim())))
        this.closeForm();
    });
  }

  protected closeForm(): void {
    this.name.set(String.empty);
    this.command.set(String.empty);
    this.argumentLines.set(String.empty);
    this.variables.set([]);
    this.formOpen.set(false);
  }

  protected done(): void {
    this.closed.emit();
  }

  private reportOf(action: ChatAction.AddAcpAgent | ChatAction.RemoveAcpAgent, target: string, name: string): (message: string) => void {
    const later = this.store().acpAgentFailed(action, target, name);
    return message => this.destroyRef.destroyed ? later(message) : this.error.set(message);
  }

  private refusal(): string | null {
    if (this.name().trim().length === 0)
      return Resources.acpLocalNameRequired;
    if (this.command().trim().length === 0)
      return Resources.acpLocalCommandRequired;
    const names = this.variables().map(t => t.name);
    const invalid = names.find(t => !Resources.acpVariableNamePattern.test(t));
    if (!Object.isUndefined(invalid))
      return Resources.formatAcpLocalVariableInvalid(invalid);
    if (new Set(names).size !== names.length)
      return Resources.acpLocalVariableRepeated;
    return this.variables().some(t => t.value.length === 0) ? Resources.acpLocalValueRequired : null;
  }

  private async work(key: string, action: () => Promise<unknown>): Promise<void> {
    const run = this.run(key, action);
    this.pending.add(run);
    try {
      await run;
    }
    finally {
      this.pending.delete(run);
    }
  }

  private async run(key: string, action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    this.working.update(t => new Set([...t, key]));
    try {
      await action();
      await this.load();
    }
    finally {
      this.working.update(t => new Set([...t].filter(u => u !== key)));
    }
  }

  private async load(): Promise<void> {
    const listing = await this.store().listAcpAgents(this.report);
    if (Object.isNull(listing))
      return;
    this.listing.set(listing);
    void this.loadIconsAsync(listing);
  }

  private keepFocus(id: string): void {
    if (!this.host.isConnected)
      return;
    const owner = this.host.ownerDocument;
    afterNextRender(() => {
      if (Object.isNull(owner.activeElement) || owner.activeElement === owner.body)
        [...this.host.querySelectorAll<HTMLElement>(Resources.acpAgentSelector)].find(t => t.dataset["agent"] === id)
          ?.querySelector<HTMLElement>(`${Resources.acpRemoveSelector}, ${Resources.acpAddSelector}`)?.focus();
    }, { injector: this.injector });
  }

  private async loadIconsAsync(listing: AcpAgentListing): Promise<void> {
    await Promise.all(listing.agents.filter(t => !this.icons().has(t.id)).map(async t => {
      const icon = await this.store().readAcpAgentIcon(t.id);
      if (!Object.isNull(icon))
        this.icons.update(u => new Map([...u, [t.id, icon]]));
    }));
  }
}
