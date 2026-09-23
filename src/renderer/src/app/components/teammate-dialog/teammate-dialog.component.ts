/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import "@noldova/teamrun-foundation-core";
import { Harness, type Teammate, TeammateCreateParams, TeammateUpdateParams, TeammateName } from "@noldova/teamrun-protocol";
import { ModelCatalog } from "../../models/model-catalog";
import { AccountChoice } from "../../models/account-choice";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { ModelCatalogService } from "../../services/model-catalog.service";

@Component({
  selector: "tr-teammate-dialog",
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./teammate-dialog.component.html"
})
export class TeammateDialogComponent {
  protected readonly resources = Resources;
  protected readonly store = inject(ChatStore);
  protected readonly original = inject<Teammate | null>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialogRef<TeammateDialogComponent>);
  private readonly catalogs = inject(ModelCatalogService);
  protected readonly name = signal(this.original?.name ?? String.empty);
  protected readonly role = signal(this.original?.role ?? String.empty);
  protected readonly accountId = signal(this.original?.providerAccountId ?? this.store.accounts()[0]?.id ?? String.empty);
  protected readonly model = signal<string | null>(this.original?.model ?? null);
  protected readonly effort = signal<string | null>(this.original?.effort ?? null);
  protected readonly account = computed(() => this.store.accounts().find(t => t.id === this.accountId()));
  protected readonly accounts = computed(() => AccountChoice.saved(this.store.accounts(), this.store.providers()));
  private catalogGeneration: number = 0;
  private reconcileAccount: string | null = null;
  protected readonly catalog = signal<ModelCatalog | null>(null);
  protected readonly selectedModel = computed(() => this.catalog()?.models.find(t => t.matches(this.model())));
  protected readonly efforts = computed(() => this.selectedModel()?.effortLevels ?? []);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canSave = computed(() => {
    try { TeammateName.validate(this.name().trim()); }
    catch { return false; }
    return this.accountId().length > 0 && !this.loading();
  });

  public constructor() {
    effect(() => { this.accountId(); untracked(() => this.loadModels()); });
  }

  protected changeAccount(id: string): void {
    if (id === this.accountId())
      return;
    this.reconcileAccount = id;
    this.catalog.set(null);
    this.loading.set(true);
    this.accountId.set(id);
  }

  protected changeModel(model: string | null): void {
    this.model.set(model);
    this.effort.set(this.catalog()?.resolveEffort(model, this.effort()) ?? null);
  }

  protected async loadModels(refresh: boolean = false): Promise<void> {
    const generation = ++this.catalogGeneration;
    const account = this.account();
    if (!refresh)
      this.catalog.set(null);
    this.loading.set(false);
    if (Object.isUndefined(account))
      return;
    this.loading.set(true);
    const catalog = await this.catalogs.load(account.provider, account.id, refresh);
    if (generation === this.catalogGeneration && this.accountId() === account.id) {
      this.catalog.set(catalog);
      this.loading.set(false);
      if (!catalog.failed && this.reconcileAccount === account.id) {
        const previous = this.model();
        const model = catalog.resolveModel(previous);
        this.model.set(model);
        this.effort.set(model === previous ? catalog.resolveEffort(model, this.effort()) : null);
        this.reconcileAccount = null;
      }
    }
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSave() || this.saving())
      return;
    this.saving.set(true);
    this.dialog.disableClose = true;
    const name = this.name().trim();
    const role = this.role().trim() || null;
    const params = Object.isNull(this.original)
      ? new TeammateCreateParams(name, role, this.accountId(), Harness.Provider, this.model(), this.effort())
      : new TeammateUpdateParams(this.original.id, name, role, this.accountId(), Harness.Provider, this.model(), this.effort());
    const saved = await this.store.saveTeammate(params);
    this.saving.set(false);
    this.dialog.disableClose = false;
    if (saved)
      this.dialog.close(true);
    else
      this.error.set(this.store.error());
  }
}
