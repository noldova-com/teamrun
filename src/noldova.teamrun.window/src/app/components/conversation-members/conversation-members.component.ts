/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, type InputSignal, type Signal, type WritableSignal, computed, effect, inject, input, signal, untracked }
  from "@angular/core";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { NameOrder, type Teammate } from "@noldova/teamrun.protocol";
import { IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { CatalogReads } from "../../models/catalog-reads";
import { CatalogSource } from "../../models/catalog-source";
import { ComposerSettings } from "../../models/composer-settings";
import { ModelCatalog } from "../../models/model-catalog";
import { ChatStoreService } from "../../services/chat-store.service";
import { ConversationActions } from "../../services/conversation-actions";
import { ComposerChoicesService } from "../../services/composer-choices.service";
import { ComposerDefaultService } from "../../services/composer-default.service";
import { EngineResync } from "../../services/engine-resync";
import { FormatterService } from "../../services/formatter.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";

@Component({
  selector: "nol-teamrun-conversation-members",
  imports: [IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, TeammateAvatarComponent, TooltipDirective],
  providers: [ComposerDefaultService.provider],
  templateUrl: "./conversation-members.component.html",
  styleUrl: "./conversation-members.component.css",
  host: {
    "role": "group",
    "[attr.aria-label]": "resources.conversationMembersLabel"
  }
})
export class ConversationMembersComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly choices: ComposerChoicesService = inject(ComposerChoicesService);
  private readonly defaults: ComposerDefaultService = inject(ComposerDefaultService);
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly usage: UsageFormatterService = inject(UsageFormatterService);

  public readonly conversationId: InputSignal<string> = input.required<string>();

  protected readonly members: Signal<readonly Teammate[]> = computed(() => NameOrder.sort(this.store.membersOf(this.conversationId())
    .map(t => this.store.teammate(t.teammateId)).filter((t): t is Teammate => !Object.isNull(t)), t => t.name));
  protected readonly attachedFolder: Signal<string | null> = computed(() => this.store.conversation(this.conversationId())?.attachedFolder ?? null);
  protected readonly others: Signal<readonly Teammate[]> = computed(() => this.store.teammates().filter(t => !this.members().includes(t)));
  private readonly catalogs: WritableSignal<ReadonlyMap<string, ModelCatalog>> = signal(new Map());
  private readonly catalogReads: CatalogReads = new CatalogReads();
  private readonly defaultSettings: Signal<ComposerSettings | null> = computed(() => this.choices.choiceOf(this.conversationId())
    ?? ComposerSettings.startingWith(this.store.defaultTeammate(), this.defaults.defaultChoice()));
  private readonly defaultKind: Signal<string | null> = computed(() => this.defaultSettings()?.kind ?? this.store.kinds()[0]?.id ?? null);
  protected readonly defaultDescription: Signal<string> = computed(() => {
    const settings = this.defaultSettings();
    const kind = this.defaultKind();
    const catalog = Object.isNull(kind) ? undefined : this.catalogs().get(ConversationMembersComponent.catalogKey(kind, settings?.providerId ?? null));
    const thread = this.store.followedThreadOf(this.conversationId(), null, kind, settings?.providerId ?? null, settings?.model ?? null, settings?.effort ?? null);
    const model = thread?.model ?? settings?.model ?? null;
    return [Resources.defaultTeammateLabel, Object.isNull(kind) ? Resources.teamRunLabel
      : this.formatter.providerLine(kind, this.store.providers().find(t => t.id === settings?.providerId), this.store.kinds()),
      this.formatter.modelName(model, kind, this.store.kinds(), catalog), ModelCatalog.effortNameIn(catalog, model, thread?.effort ?? settings?.effort ?? null)]
      .join(Resources.titleSeparator);
  });

  public constructor() {
    const resynced: WritableSignal<number> = signal(0);
    inject(DestroyRef).onDestroy(EngineResync.on(inject(WindowPartTokens.context), () => resynced.update(t => t + 1)));
    effect(() => {
      resynced();
      const kind = this.defaultKind();
      const teammates = this.store.teammates().flatMap(t => {
        const provider = this.store.providers().find(u => u.id === t.providerId);
        return Object.isUndefined(provider) || this.store.isTeammateUnavailable(t.id) ? [] : [new CatalogSource(provider.kind, t.providerId)];
      });
      const wanted: readonly CatalogSource[] = Object.isNull(kind) ? teammates : [...teammates, new CatalogSource(kind, this.defaultSettings()?.providerId ?? null)];
      untracked(() => {
        for (const source of wanted) {
          const key = ConversationMembersComponent.catalogKey(source.kind, source.providerId);
          this.catalogReads.follow(key, this.store.modelCatalogs.load(source.kind, source.providerId), t => this.catalogs.update(u => new Map(u).set(key, t)));
        }
      });
    });
  }

  protected folderNameOf(folder: string): string {
    return ConversationActions.folderNameOf(folder);
  }

  protected description(teammate: Teammate): string {
    const usedUp = this.usage.usedUpLabel(this.store.planUsageOfProvider(teammate.providerId));
    const state = this.store.isTeammateProviderDisabled(teammate.id) ? [Resources.providerDisabledLabel]
      : this.store.isTeammateUnavailable(teammate.id) ? [Resources.unavailableTeammateLabel] : Object.isNull(usedUp) ? [] : [usedUp];
    const provider = this.store.providers().find(t => t.id === teammate.providerId);
    const catalog = Object.isUndefined(provider) ? undefined : this.catalogs().get(ConversationMembersComponent.catalogKey(provider.kind, provider.id));
    const thread = Object.isUndefined(provider) ? null
      : this.store.followedThreadOf(this.conversationId(), teammate.id, provider.kind, provider.id, teammate.model, teammate.effort);
    return [teammate.name, this.formatter.teammateSummary(teammate, this.store.providers(), this.store.kinds(), catalog, thread), ...state].join(Resources.titleSeparator);
  }

  private static catalogKey(kind: string, providerId: string | null): string {
    return JSON.stringify([kind, providerId]);
  }
}
