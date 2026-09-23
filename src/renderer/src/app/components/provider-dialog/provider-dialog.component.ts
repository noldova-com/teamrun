/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import "@noldova/teamrun-foundation-core";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";

@Component({
  selector: "tr-provider-dialog",
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./provider-dialog.component.html"
})
export class ProviderDialogComponent {
  protected readonly resources = Resources;
  protected readonly store = inject(ChatStore);
  private readonly dialog = inject(MatDialogRef<ProviderDialogComponent>);
  protected readonly provider = signal<string | null>(this.store.providers()[0]?.id ?? null);
  protected readonly label = signal(String.empty);
  protected readonly profileDir = signal(String.empty);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly canSave = computed(() => !this.saving() && !Object.isNull(this.provider())
    && !String.isNullOrWhitespace(this.label()) && !String.isNullOrWhitespace(this.profileDir()));

  protected async pickProfile(): Promise<void> {
    const path = await this.store.pickDirectory();
    if (!Object.isNull(path))
      this.profileDir.set(path);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const provider = this.provider();
    if (!this.canSave() || Object.isNull(provider))
      return;
    this.saving.set(true);
    this.dialog.disableClose = true;
    const saved = await this.store.addAccount(provider, this.label().trim(), this.profileDir().trim());
    this.saving.set(false);
    this.dialog.disableClose = false;
    if (saved)
      this.dialog.close(true);
    else
      this.error.set(this.store.error());
  }
}
