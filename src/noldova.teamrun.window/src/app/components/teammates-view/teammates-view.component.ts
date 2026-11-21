/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, Injector, type Signal, signal, untracked, viewChild, type WritableSignal }
  from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { type DefaultTeammate, type Provider, type Teammate, TeammateName } from "@noldova/teamrun.protocol";
import {
  AvatarComponent,
  AvatarSize,
  ButtonComponent,
  ButtonVariant,
  ConfigurationTableActionDirective,
  ConfigurationTableComponent,
  ConfigurationTableDirective,
  ConfigurationTableFillDirective,
  ConfigurationTableRowActionsDirective,
  ConfigurationTableShareDirective,
  DialogService,
  IconButtonComponent,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { CatalogReads } from "../../models/catalog-reads";
import { ComposerSettings } from "../../models/composer-settings";
import { ConfirmRequest } from "../../models/confirm-request";
import { FocusAfterDelete } from "../../models/focus-after-delete";
import { ModelCatalog } from "../../models/model-catalog";
import { ChatStoreService } from "../../services/chat-store.service";
import { ComposerChoicesService } from "../../services/composer-choices.service";
import { ComposerDefaultService } from "../../services/composer-default.service";
import { ConversationActions } from "../../services/conversation-actions";
import { EngineResync } from "../../services/engine-resync";
import { FormatterService } from "../../services/formatter.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";

@Component({
  selector: "nol-teamrun-teammates-view",
  imports: [AvatarComponent, ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective,
    ConfigurationTableFillDirective, ConfigurationTableRowActionsDirective, ConfigurationTableShareDirective, IconButtonComponent, TooltipDirective],
  providers: [ChatStoreService.provider, ComposerDefaultService.provider],
  templateUrl: "./teammates-view.component.html",
  styleUrl: "../settings-view.css"
})
export class TeammatesViewComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  protected readonly error: WritableSignal<string | null> = signal(null);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly choices: ComposerChoicesService = inject(ComposerChoicesService);
  private readonly defaults: ComposerDefaultService = inject(ComposerDefaultService);
  private readonly injector: Injector = inject(Injector);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly changeDefaultButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild("changeDefaultButton", { read: ElementRef });
  private readonly clearDefaultButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild("clearDefaultButton", { read: ElementRef });
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly usage: UsageFormatterService = inject(UsageFormatterService);
  private readonly catalogs: WritableSignal<ReadonlyMap<string, ModelCatalog>> = signal(new Map());
  private readonly catalogReads: CatalogReads = new CatalogReads();
  private readonly report: (message: string) => void = t => this.error.set(t);

  public constructor() {
    effect(() => {
      if (this.store.defaultTeammateAsked())
        untracked(() => {
          this.store.askForDefaultTeammate(false);
          this.chooseDefault();
        });
    });
    const resynced: WritableSignal<number> = signal(0);
    inject(DestroyRef).onDestroy(EngineResync.on(this.context, () => resynced.update(u => u + 1)));
    effect(() => {
      resynced();
      const providers = this.store.providers();
      const chosen = new Set(this.store.teammates().filter(t => !Object.isNull(t.model) || !Object.isNull(t.effort)).map(t => t.providerId));
      untracked(() => {
        for (const provider of providers.filter(t => chosen.has(t.id)))
          this.catalogReads.follow(provider.id, this.store.modelCatalogs.load(provider.kind, provider.id), t => this.catalogs.update(u => new Map(u).set(provider.id, t)));
      });
    });
  }

  protected initials(teammate: Teammate): string {
    return TeammateName.initials(teammate.name);
  }

  protected connection(teammate: Teammate): string {
    const provider = this.store.providers().find(t => t.id === teammate.providerId);
    if (Object.isUndefined(provider))
      return Resources.unavailableTeammateLabel;
    return this.connectionName(provider.kind, provider);
  }

  protected usedUpOf(teammate: Teammate): string | null {
    return this.usage.usedUpLabel(this.store.planUsageOfProvider(teammate.providerId));
  }

  protected summary(teammate: Teammate): string {
    const provider = this.store.providers().find(t => t.id === teammate.providerId);
    const connection = Object.isUndefined(provider) ? Resources.unavailableTeammateLabel : this.formatter.providerLine(provider.kind, provider, this.store.kinds());
    return [teammate.name, connection, this.model(teammate), this.effortName(teammate)].join(Resources.titleSeparator);
  }

  protected effortName(teammate: Teammate): string {
    return ModelCatalog.effortNameIn(this.catalogs().get(teammate.providerId), teammate.model, teammate.effort);
  }

  protected modelName(teammate: Teammate): string {
    return this.formatter.teammateModel(teammate, this.store.providers(), this.store.kinds(), this.catalogs().get(teammate.providerId));
  }

  protected unlisted(teammate: Teammate): boolean {
    const catalog = this.catalogs().get(teammate.providerId);
    return !Object.isNull(teammate.model) && !Object.isUndefined(catalog) && catalog.knowsModels && Object.isNull(catalog.resolveModel(teammate.model));
  }

  private model(teammate: Teammate): string {
    return this.unlisted(teammate) ? Resources.formatUnlisted(this.modelName(teammate)) : this.modelName(teammate);
  }

  protected defaultConnection(chosen: DefaultTeammate): string {
    if (Object.isNull(chosen.providerId))
      return [this.formatter.providerName(chosen.requested.kind, this.store.kinds()), Resources.noProviderLabel].join(Resources.titleSeparator);
    const provider = this.store.providers().find(t => t.id === chosen.providerId);
    return Object.isUndefined(provider) ? Resources.unavailableTeammateLabel : this.connectionName(chosen.requested.kind, provider);
  }

  protected defaultModel(chosen: DefaultTeammate): string {
    return this.formatter.modelName(chosen.requested.model, chosen.requested.kind, this.store.kinds(),
      Object.isNull(chosen.providerId) ? undefined : this.catalogs().get(chosen.providerId));
  }

  protected defaultEffort(chosen: DefaultTeammate): string {
    const catalog = Object.isNull(chosen.providerId) ? undefined : this.catalogs().get(chosen.providerId);
    return ModelCatalog.effortNameIn(catalog, chosen.requested.model, chosen.requested.effort);
  }

  protected chooseDefault(): void {
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-provider button");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("choosesDefault", true);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected async clearDefault(): Promise<void> {
    const button = this.clearDefaultButton()?.nativeElement;
    const hadFocus = !Object.isUndefined(button) && button.ownerDocument.activeElement === button;
    await this.store.setDefaultTeammate(null, this.report);
    if (hadFocus)
      afterNextRender(() => {
        const active = button.ownerDocument.activeElement;
        if (Object.isNull(active) || active === button.ownerDocument.body)
          this.changeDefaultButton()?.nativeElement.focus();
      }, { injector: this.injector });
  }

  protected edit(teammate: Teammate | null): void {
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("teammate", teammate);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected async startChat(teammate: Teammate): Promise<void> {
    const created = await ConversationActions.start(this.context, this.store, this.store.selectedProjectId(), teammate.id, this.report);
    if (Object.isNull(created))
      return;
    const provider = this.store.providers().find(t => t.id === teammate.providerId);
    const kind = this.store.kinds()[0]?.id;
    const defaults = ComposerSettings.startingWith(this.store.defaultTeammate(), this.defaults.defaultChoice())
      ?? (Object.isUndefined(kind) ? null : new ComposerSettings(kind, null, null, null));
    if (!Object.isUndefined(provider))
      this.choices.remember(created.id, new ComposerSettings(provider.kind, teammate.model, teammate.effort, provider.id, teammate.id, teammate.speed));
    else if (!Object.isNull(defaults))
      this.choices.remember(created.id, defaults.withResponder(teammate.id));
  }

  protected remove(teammate: Teammate): void {
    const control = document.activeElement;
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", new ConfirmRequest(Resources.deleteTeammateLabel, Resources.formatDeleteTeammate(teammate.name), Resources.deleteTeammateLabel,
      null, true));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void this.delete(teammate, control);
    });
  }

  private async delete(teammate: Teammate, control: Element | null): Promise<void> {
    const ids = [...this.host.querySelectorAll<HTMLElement>(".nol-teamrun-item[data-teammate]")].map(t => t.dataset["teammate"]);
    const at = ids.indexOf(teammate.id);
    const neighbour = ids[at + 1] ?? ids[at - 1];
    if (await this.store.deleteTeammate(teammate, this.report))
      FocusAfterDelete.later(this.injector, control,
        () => Object.isUndefined(neighbour) ? null : this.host.querySelector<HTMLElement>(`.nol-teamrun-item[data-teammate="${CSS.escape(neighbour)}"] .nol-teamrun-delete`),
        () => this.host.querySelector<HTMLElement>(".nol-teamrun-add"));
  }

  private connectionName(kind: string, provider: Provider): string {
    const line = this.formatter.providerLine(kind, provider, this.store.kinds());
    return provider.enabled ? line : Resources.formatDisabledProviderOption(line);
  }

}
