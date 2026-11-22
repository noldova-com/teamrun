/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { AbilityAnswer, ProviderAbilities, type ProviderAbility, type ProviderKind } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, SelectComponent, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { AbilityGroup } from "../../models/ability-group";
import { AbilityGroupView } from "../../models/ability-group-view";
import { AbilityRow } from "../../models/ability-row";
import { AbilitySettingsRows } from "../../services/ability-settings-rows";
import { ChatStoreService } from "../../services/chat-store.service";

@Component({
  selector: "nol-teamrun-abilities-page",
  imports: [ButtonComponent, SelectComponent],
  providers: [ChatStoreService.provider],
  templateUrl: "./abilities-page.component.html",
  styleUrls: ["../failure-row.css", "./abilities-page.component.css"]
})
export class AbilitiesPageComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly rows: AbilitySettingsRows | null = AbilitySettingsRows.of(this.context);
  private readonly chosen: WritableSignal<string | null> = signal(this.rows?.chosen ?? null);

  protected readonly kinds: Signal<readonly ProviderKind[]> = computed(() => this.store.kinds().filter(t => !Object.isNull(t.abilities)));
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => this.kinds().map(t => new SelectOption(t.id, t.displayName)));
  protected readonly kind: Signal<ProviderKind | undefined> = computed(() => AbilitySettingsRows.kindOf(this.kinds(), this.chosen()));
  protected readonly groups: Signal<readonly AbilityGroupView[]> = computed(() => {
    const kind = this.kind();
    const abilities = kind?.abilities;
    return Object.isNullOrUndefined(kind) || Object.isNullOrUndefined(abilities) ? []
      : AbilityGroup.all.map(t => new AbilityGroupView(t.title, t.abilities.map(u => AbilitiesPageComponent.rowOf(abilities, u, kind.displayName))));
  });

  protected async retryKinds(): Promise<void> {
    if (!this.store.loadingKinds())
      await this.store.initialize();
  }

  protected choose(id: string): void {
    this.chosen.set(id);
    this.rows?.choose(id);
  }

  private static rowOf(abilities: ProviderAbilities, ability: ProviderAbility, displayName: string): AbilityRow {
    const cell = abilities.cellOf(ability);
    const works = cell.answer === AbilityAnswer.Works;
    const reason = cell.reasonFor(displayName);
    return new AbilityRow(ability, Resources.formatAbilitySettingId(ability), ProviderAbilities.names[ability], cell.answerLabel, works,
      works || Object.isNull(reason) ? cell.sourceNote : Resources.formatAbilityReason(reason));
  }
}
