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
import type { IAbilityGroupView } from "../../interfaces/i-ability-group-view";
import type { IAbilityRow } from "../../interfaces/i-ability-row";
import { AbilityGroup } from "../../models/ability-group";
import { AbilitySettingsRows } from "../../services/ability-settings-rows";
import { ChatStoreService } from "../../services/chat-store.service";

@Component({
  selector: "nol-teamrun-abilities-page",
  imports: [ButtonComponent, SelectComponent],
  providers: [ChatStoreService.provider],
  templateUrl: "./abilities-page.component.html",
  styleUrl: "./abilities-page.component.css"
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
  protected readonly groups: Signal<readonly IAbilityGroupView[]> = computed(() => {
    const kind = this.kind();
    const abilities = kind?.abilities;
    return Object.isNullOrUndefined(kind) || Object.isNullOrUndefined(abilities) ? []
      : AbilityGroup.all.map(t => ({ title: t.title, rows: t.abilities.map(u => AbilitiesPageComponent.rowOf(abilities, u, kind.displayName)) }));
  });

  protected async retryKinds(): Promise<void> {
    if (!this.store.loadingKinds())
      await this.store.initialize();
  }

  protected choose(id: string): void {
    this.chosen.set(id);
    this.rows?.choose(id);
  }

  private static rowOf(abilities: ProviderAbilities, ability: ProviderAbility, displayName: string): IAbilityRow {
    const cell = abilities.cellOf(ability);
    const works = cell.answer === AbilityAnswer.Works;
    const reason = cell.reasonFor(displayName);
    return {
      ability, settingId: Resources.formatAbilitySettingId(ability), name: ProviderAbilities.names[ability], answer: cell.answerLabel, works,
      description: works || Object.isNull(reason) ? cell.sourceNote : Resources.formatAbilityReason(reason)
    };
  }
}
