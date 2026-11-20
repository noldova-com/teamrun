/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, ElementRef, Injector, type InputSignal, type OutputEmitterRef, type Signal, type WritableSignal, afterNextRender, computed, inject, input, linkedSignal,
  output, signal
} from "@angular/core";

import "@noldova/context.core";
import { Resources as ProtocolResources, type SharedMcpServer, SharedMcpHeader, SharedMcpServerDefinition, SharedMcpTransport, SharedMcpVariable,
  SharedMcpVariableSource } from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, Announcer, ButtonComponent, ButtonVariant, CheckboxComponent, DialogComponent, FieldMessageComponent, SelectComponent, SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { SharedMcpRefusal } from "../../models/shared-mcp-refusal";
import type { ChatStoreService } from "../../services/chat-store.service";
import { TimeFormatService } from "../../services/time-format.service";

@Component({
  selector: "nol-teamrun-shared-mcp-server-dialog",
  imports: [ButtonComponent, CheckboxComponent, DialogComponent, FieldMessageComponent, SelectComponent, TextFieldComponent],
  templateUrl: "./shared-mcp-server-dialog.component.html",
  styleUrl: "../settings-dialog.css"
})
export class SharedMcpServerDialogComponent {
  public readonly savedSecrets: WritableSignal<readonly string[]> = signal([]);
  public readonly savedName: WritableSignal<string> = signal(String.empty);
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly stdio: SharedMcpTransport = SharedMcpTransport.Stdio;
  protected readonly transports: readonly SharedMcpTransport[] = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];
  protected readonly transportOptions: readonly SelectOption[] = this.transports.map(t => new SelectOption(t, Resources.sharedMcpTransportLabels[t]));
  protected readonly sourceOptions: readonly SelectOption[] = Resources.sharedMcpVariableSourceOrder
    .map(t => new SelectOption(t, Resources.sharedMcpVariableSourceLabels[t]));
  protected readonly nameHintId: string = "nol-teamrun-shared-mcp-name-hint";
  protected readonly argumentsHintId: string = "nol-teamrun-shared-mcp-arguments-hint";
  protected readonly urlHintId: string = "nol-teamrun-shared-mcp-url-hint";
  protected readonly variablesHintId: string = "nol-teamrun-shared-mcp-variables-hint";
  protected readonly headersHintId: string = "nol-teamrun-shared-mcp-headers-hint";
  protected readonly bearerHintId: string = "nol-teamrun-shared-mcp-bearer-hint";
  protected readonly valuesHintId: string = "nol-teamrun-shared-mcp-values-hint";
  protected readonly messageId: string = "nol-teamrun-shared-mcp-message";
  protected readonly nameField: string = ProtocolResources.nameField;
  protected readonly variablesField: string = ProtocolResources.variablesField;
  protected readonly urlField: string = ProtocolResources.urlField;
  protected readonly headersField: string = ProtocolResources.headersField;
  protected readonly bearerField: string = ProtocolResources.bearerVariableField;
  protected readonly signsInField: string = ProtocolResources.signsInField;
  protected readonly signsInHintId: string = "nol-teamrun-shared-mcp-signs-in-hint";

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly server: InputSignal<SharedMcpServer | null> = input<SharedMcpServer | null>(null);
  public readonly variables: InputSignal<readonly SharedMcpVariable[]> = input<readonly SharedMcpVariable[]>([]);
  public readonly closed: OutputEmitterRef<boolean> = output<boolean>();

  protected readonly name: WritableSignal<string> = linkedSignal(() => this.server()?.definition.name ?? String.empty);
  protected readonly transport: WritableSignal<SharedMcpTransport> = linkedSignal(() => this.server()?.definition.transport ?? SharedMcpTransport.Stdio);
  protected readonly command: WritableSignal<string> = linkedSignal(() => this.server()?.definition.command ?? String.empty);
  protected readonly argumentLines: WritableSignal<string> = linkedSignal(() => SharedMcpServerDialogComponent.linesOf(this.server()?.definition.arguments ?? []));
  protected readonly variableLines: WritableSignal<string> = linkedSignal(() => SharedMcpServerDialogComponent.linesOf(this.server()?.definition.variables ?? []));
  protected readonly url: WritableSignal<string> = linkedSignal(() => this.server()?.definition.url ?? String.empty);
  protected readonly headerLines: WritableSignal<string> = linkedSignal(() => SharedMcpServerDialogComponent.linesOf((this.server()?.definition.headers ?? [])
    .map(t => `${t.name}${Resources.sharedMcpHeaderSeparator} ${t.variable}`)));
  protected readonly bearer: WritableSignal<string> = linkedSignal(() => this.server()?.definition.bearerVariable ?? String.empty);
  protected readonly signsIn: WritableSignal<boolean> = linkedSignal(() => this.server()?.definition.signsIn ?? false);
  protected readonly locked: Signal<SharedMcpServerDefinition | null> = computed(() => {
    const definition = this.server()?.definition ?? null;
    return Object.isNull(definition) || Object.isNull(definition.account) ? null : definition;
  });
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly refusal: WritableSignal<SharedMcpRefusal | null> = signal(null);
  protected readonly named: Signal<readonly string[]> = computed(() => [...new Set(this.isStdio()
    ? SharedMcpServerDialogComponent.listOf(this.variableLines())
    : [...SharedMcpServerDialogComponent.listOf(this.headerLines()).filter(t => t.includes(Resources.sharedMcpHeaderSeparator))
      .map(t => t.slice(t.indexOf(Resources.sharedMcpHeaderSeparator) + 1).trim()), this.signsIn() ? String.empty : this.bearer().trim()])]
    .filter(t => ProtocolResources.environmentVariablePattern.test(t)));
  protected readonly moved: Signal<string | null> = computed(() => {
    const variables = this.movedVariables().filter(t => this.named().includes(t) && this.entryOf(t).length > 0);
    return variables.length > 0 ? Resources.formatSharedMcpMovedToSaved(variables) : null;
  });
  protected readonly title: Signal<string> = computed(() => Object.isNull(this.server()) ? Resources.addSharedMcpServerTitle : Resources.editSharedMcpServerTitle);
  protected readonly isStdio: Signal<boolean> = computed(() => this.transport() === SharedMcpTransport.Stdio);
  protected readonly canSave: Signal<boolean> = computed(() => !this.saving() && !String.isNullOrWhitespace(this.name())
    && !String.isNullOrWhitespace(this.isStdio() ? this.command() : this.url()) && this.named().every(t => !this.lacksValue(t)));
  private readonly known: WritableSignal<ReadonlyMap<string, SharedMcpVariable>> = linkedSignal(() => new Map(this.variables().map(t => [t.variable, t] as const)));
  private readonly sources: WritableSignal<ReadonlyMap<string, SharedMcpVariableSource>> = signal(new Map());
  private readonly entries: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly changing: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly valueRefusals: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly shown: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly movedVariables: WritableSignal<readonly string[]> = signal([]);
  private readonly times: TimeFormatService = inject(TimeFormatService);
  private readonly announcer: Announcer = inject(Announcer);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly savedId: WritableSignal<string | null> = linkedSignal(() => this.server()?.id ?? null);
  private readonly stored: WritableSignal<boolean> = signal(false);
  private readonly report: (message: string) => void = t => this.error.set(t);

  protected edit(target: WritableSignal<string>, event: globalThis.Event): void {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement))
      return;
    target.set(event.target.value);
    this.error.set(null);
    this.refusal.set(null);
  }

  protected changeSignsIn(on: boolean): void {
    this.signsIn.set(on);
    this.error.set(null);
    this.refusal.set(null);
  }

  protected changeTransport(value: string): void {
    this.transport.set(this.transports.find(t => t === value) ?? this.transport());
    this.error.set(null);
    this.refusal.set(null);
  }

  protected refusalOf(field: string): string | null {
    const refusal = this.refusal();
    return refusal?.field === field ? refusal.message : null;
  }

  protected refusalIdOf(field: string): string {
    return `nol-teamrun-shared-mcp-${field}-message`;
  }

  protected describedBy(field: string, ...ids: (string | null)[]): string | null {
    const all = [...ids, Object.isNull(this.refusalOf(field)) ? null : this.refusalIdOf(field)].filter(t => !Object.isNull(t));
    return all.length === 0 ? null : all.join(" ");
  }

  protected sourceOf(variable: string): SharedMcpVariableSource {
    return this.sources().get(variable) ?? this.known().get(variable)?.source ?? SharedMcpVariableSource.Environment;
  }

  protected isSaved(variable: string): boolean {
    const known = this.known().get(variable);
    return this.sourceOf(variable) === SharedMcpVariableSource.Saved && known?.source === SharedMcpVariableSource.Saved && known.set
      && !this.changing().has(variable);
  }

  protected isNotSet(variable: string): boolean {
    const known = this.known().get(variable);
    return !Object.isUndefined(known) && known.source === this.sourceOf(variable) && !known.set;
  }

  protected takesValue(variable: string): boolean {
    return !this.isSaved(variable) && (this.sourceOf(variable) === SharedMcpVariableSource.Saved || this.isNotSet(variable));
  }

  protected updatedOf(variable: string): string | null {
    const at = this.known().get(variable)?.updatedAt ?? null;
    return Object.isNull(at) ? null : Resources.formatSharedMcpSecretUpdated(this.times.dateTime(at));
  }

  protected isShown(variable: string): boolean {
    return this.shown().has(variable);
  }

  protected toggleShown(variable: string): void {
    this.shown.update(t => t.has(variable) ? new Set([...t].filter(u => u !== variable)) : new Set([...t, variable]));
  }

  protected entryOf(variable: string): string {
    return this.entries().get(variable) ?? String.empty;
  }

  protected valueRefusalOf(variable: string): string | null {
    return this.valueRefusals().get(variable) ?? null;
  }

  protected valueIdOf(index: number, part: string): string {
    return `${Resources.sharedMcpValueIdPrefix}${index}-${part}`;
  }

  protected valueDescribedBy(variable: string, index: number): string | null {
    const all = [this.isNotSet(variable) ? this.valueIdOf(index, "state") : null,
      Object.isNull(this.valueRefusalOf(variable)) ? null : this.valueIdOf(index, "message")].filter(t => !Object.isNull(t));
    return all.length === 0 ? null : all.join(" ");
  }

  protected changeSource(variable: string, value: string): void {
    const source = Resources.sharedMcpVariableSourceOrder.find(t => t === value);
    if (!Object.isUndefined(source))
      this.sources.update(t => new Map(t).set(variable, source));
    if (source === SharedMcpVariableSource.Environment)
      this.forget(variable);
    this.forgetRefusal(variable);
  }

  protected editValue(variable: string, event: globalThis.Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    const value = event.target.value;
    this.entries.update(t => new Map(t).set(variable, value));
    if (this.sourceOf(variable) !== SharedMcpVariableSource.Saved) {
      this.movedVariables.update(t => [...t, variable]);
      this.announcer.announce(Resources.formatSharedMcpMovedToSaved([variable]), AnnouncementPoliteness.Polite);
    }
    this.sources.update(t => new Map(t).set(variable, SharedMcpVariableSource.Saved));
    this.forgetRefusal(variable);
  }

  protected change(variable: string): void {
    this.changing.update(t => new Set([...t, variable]));
    this.focusIn(variable, Resources.sharedMcpSecretSelector);
  }

  protected remove(variable: string): void {
    this.sources.update(t => new Map(t).set(variable, SharedMcpVariableSource.Environment));
    this.forget(variable);
    this.focusIn(variable, Resources.sharedMcpSourceSelector);
  }

  protected dismiss(): void {
    if (!this.saving())
      this.closed.emit(this.stored());
  }

  protected async save(event: globalThis.Event): Promise<void> {
    event.preventDefault();
    if (!this.canSave())
      return;

    const definition = this.definition();
    if (Object.isNull(definition))
      return;
    this.saving.set(true);
    this.error.set(null);
    this.valueRefusals.set(new Map());
    const saved = await this.store().saveSharedMcpServer(this.savedId(), definition, this.report);
    if (Object.isNull(saved)) {
      this.saving.set(false);
      return;
    }
    this.savedId.set(saved.id);
    this.stored.set(true);
    this.savedName.set(saved.definition.name);
    this.savedSecrets.update(t => t.filter(u => definition.referencedVariables.includes(u)));
    let kept = true;
    for (const variable of new Set(definition.referencedVariables))
      kept = await this.keep(saved.id, variable) && kept;
    this.saving.set(false);
    if (kept)
      this.closed.emit(true);
  }

  private async keep(serverId: string, variable: string): Promise<boolean> {
    const report = (message: string): void => this.valueRefusals.update(t => new Map(t).set(variable, message));
    const value = this.entryOf(variable);
    if (this.sourceOf(variable) === SharedMcpVariableSource.Saved && value.length > 0) {
      if (!await this.store().saveSharedMcpSecret(serverId, variable, value, report))
        return false;
      this.known.update(t => new Map(t).set(variable, new SharedMcpVariable(variable, SharedMcpVariableSource.Saved, true, new Date().toISOString())));
      this.forget(variable);
      this.savedSecrets.update(t => [...t.filter(u => u !== variable), variable]);
      return true;
    }
    if (this.sourceOf(variable) !== SharedMcpVariableSource.Environment || this.known().get(variable)?.source !== SharedMcpVariableSource.Saved)
      return true;
    if (!await this.store().removeSharedMcpSecret(serverId, variable, report))
      return false;
    this.known.update(t => new Map([...t].filter(([name]) => name !== variable)));
    this.savedSecrets.update(t => t.filter(u => u !== variable));
    return true;
  }

  private lacksValue(variable: string): boolean {
    return this.sourceOf(variable) === SharedMcpVariableSource.Saved && this.known().get(variable)?.source !== SharedMcpVariableSource.Saved
      && this.entryOf(variable).length === 0;
  }

  private forget(variable: string): void {
    this.entries.update(t => new Map([...t].filter(([name]) => name !== variable)));
    this.shown.update(t => new Set([...t].filter(u => u !== variable)));
    this.movedVariables.update(t => t.filter(u => u !== variable));
    this.changing.update(t => new Set([...t].filter(u => u !== variable)));
  }

  private forgetRefusal(variable: string): void {
    this.valueRefusals.update(t => new Map([...t].filter(([name]) => name !== variable)));
  }

  private focusIn(variable: string, selector: string): void {
    afterNextRender(() => [...this.host.querySelectorAll(Resources.sharedMcpValueSelector)].find(t => t.getAttribute("aria-label") === variable)
      ?.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }

  private definition(): SharedMcpServerDefinition | null {
    let headers: SharedMcpHeader[];
    try {
      headers = this.isStdio() ? [] : SharedMcpServerDialogComponent.listOf(this.headerLines()).map(t => {
        const at = t.indexOf(Resources.sharedMcpHeaderSeparator);
        return at < 0 ? new SharedMcpHeader(t, String.empty) : new SharedMcpHeader(t.slice(0, at).trim(), t.slice(at + 1).trim());
      });
    }
    catch (error) {
      this.refusal.set(SharedMcpRefusal.ofHeader(error));
      return null;
    }
    const name = this.name().trim();
    const locked = this.locked();
    try {
      return this.isStdio()
        ? new SharedMcpServerDefinition(name, SharedMcpTransport.Stdio, this.command().trim(), SharedMcpServerDialogComponent.listOf(this.argumentLines()),
          SharedMcpServerDialogComponent.listOf(this.variableLines()), null, [], null)
        : new SharedMcpServerDefinition(name, SharedMcpTransport.Http, null, [], [], Object.isNull(locked) ? this.url().trim() : locked.url, headers,
          this.signsIn() || String.isNullOrWhitespace(this.bearer()) ? null : this.bearer().trim(), this.signsIn(), locked?.account ?? null);
    }
    catch (error) {
      this.refusal.set(SharedMcpRefusal.ofDefinition(error, this.transport(), name));
      return null;
    }
  }

  private static linesOf(values: readonly string[]): string {
    return values.join(Resources.lineSeparator);
  }

  private static listOf(text: string): string[] {
    return text.split(/\r?\n/u).map(t => t.trim()).filter(t => t.length > 0);
  }
}
