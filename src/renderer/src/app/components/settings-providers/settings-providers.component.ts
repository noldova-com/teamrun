/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import "@noldova/teamrun-foundation-core";
import { type ProviderAccount } from "@noldova/teamrun-protocol";
import { ConfirmRequest } from "../../models/confirm-request";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { Formatter } from "../../services/formatter.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { ProviderDialogComponent } from "../provider-dialog/provider-dialog.component";

@Component({
  selector: "tr-settings-providers",
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-providers.component.html"
})
export class SettingsProvidersComponent {
  protected readonly resources = Resources;
  protected readonly store = inject(ChatStore);
  protected readonly formatter = inject(Formatter);
  private readonly dialog = inject(MatDialog);

  protected add(): void {
    this.dialog.open(ProviderDialogComponent, { width: Resources.dialogWidth });
  }

  protected remove(account: ProviderAccount): void {
    const data = new ConfirmRequest(Resources.removeProviderLabel, Resources.formatRemoveProvider(account.label), Resources.removeAccountLabel);
    this.dialog.open<ConfirmDialogComponent, ConfirmRequest, boolean>(ConfirmDialogComponent, { data, width: Resources.dialogWidth })
      .afterClosed().subscribe(confirmed => { if (confirmed) void this.store.removeAccount(account.id); });
  }
}
