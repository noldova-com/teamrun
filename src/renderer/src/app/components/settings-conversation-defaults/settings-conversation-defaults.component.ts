/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";

import "@noldova/teamrun-foundation-core";

import { ComposerSettings } from "../../models/composer-settings";
import { AccountChoice } from "../../models/account-choice";
import { ModelCatalog } from "../../models/model-catalog";
import { ModelCatalogService } from "../../services/model-catalog.service";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { PreferencesService } from "../../services/preferences.service";
import { SettingsRowComponent } from "../settings-row/settings-row.component";

@Component({
  selector: "tr-settings-conversation-defaults",
  imports: [MatButtonModule, MatFormFieldModule, MatSelectModule, SettingsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-conversation-defaults.component.html"
})
export class SettingsConversationDefaultsComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly store: ChatStore = inject(ChatStore);
  private readonly preferences: PreferencesService = inject(PreferencesService);
  protected readonly provider: WritableSignal<string | null> = signal(this.preferences.defaultComposer()?.provider ?? this.store.providers()[0]?.id ?? null);
  protected readonly model: WritableSignal<string | null> = signal(this.preferences.defaultComposer()?.model ?? null);
  protected readonly effort: WritableSignal<string | null> = signal(this.preferences.defaultComposer()?.effort ?? null);
  protected readonly accountId: WritableSignal<string | null> = signal(this.preferences.defaultComposer()?.providerAccountId ?? null);
  private readonly modelCatalogs: ModelCatalogService = inject(ModelCatalogService);
  protected readonly catalog: WritableSignal<ModelCatalog | null> = signal(null);
  protected readonly models = computed(() => this.catalog()?.models ?? []);
  protected readonly modelsLoading = signal(false);
  protected readonly selectedModel = computed(() => this.models().find(t => t.matches(this.model())));
  protected readonly effortLevels: Signal<readonly string[]> = computed(() => this.selectedModel()?.effortLevels ?? []);
  protected readonly accounts = computed(() => [...AccountChoice.saved(this.store.accounts(), this.store.providers()), ...AccountChoice.native(this.store.providers())]
    .filter(t => t.provider === this.provider()));
  protected readonly selectedAccount = computed(() => this.accounts().find(t => t.provider === this.provider() && t.accountId === this.accountId()));
  private catalogGeneration: number = 0;
  private reconcileAccount: string | null = null;

  public constructor() {
    effect(() => {
      this.provider();
      this.accountId();
      untracked(() => this.loadModels());
    });
  }

  protected selectProvider(provider: string): void {
    if (provider === this.provider())
      return;
    this.reconcileAccount = null;
    this.catalog.set(null);
    this.modelsLoading.set(true);
    this.provider.set(provider);
    this.accountId.set(null);
    this.model.set(null);
    this.effort.set(null);
    this.save();
  }

  protected selectAccount(key: string): void {
    const choice = this.accounts().find(t => t.key === key);
    if (Object.isUndefined(choice) || choice.key === this.selectedAccount()?.key)
      return;
    this.reconcileAccount = choice.key;
    this.catalog.set(null);
    this.modelsLoading.set(true);
    this.provider.set(choice.provider);
    this.accountId.set(choice.accountId);
    this.save();
  }

  protected save(): void {
    const provider = this.provider();
    this.preferences.setDefaultComposer(Object.isNull(provider) ? null : new ComposerSettings(provider, this.model(), this.effort(), this.accountId()));
  }

  protected selectModel(model: string | null): void {
    this.model.set(model);
    this.effort.set(this.catalog()?.resolveEffort(model, this.effort()) ?? null);
    this.save();
  }

  protected loadModels(refresh: boolean = false): void {
    const generation = ++this.catalogGeneration;
    const provider = this.provider();
    const account = this.accountId();
    if (!refresh)
      this.catalog.set(null);
    if (Object.isNull(provider))
      return;
    this.modelsLoading.set(true);
    void this.modelCatalogs.load(provider, account, refresh).then(catalog => {
      if (generation === this.catalogGeneration && provider === this.provider() && account === this.accountId()) {
        this.catalog.set(catalog);
        this.modelsLoading.set(false);
        if (!catalog.failed && this.reconcileAccount === this.selectedAccount()?.key) {
          const previous = this.model();
          const model = catalog.resolveModel(previous);
          this.model.set(model);
          this.effort.set(model === previous ? catalog.resolveEffort(model, this.effort()) : null);
          this.reconcileAccount = null;
          this.save();
        }
      }
    });
  }
}
