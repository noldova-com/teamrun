/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { ComputerUseGrant } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  ConfigurationTableComponent,
  ConfigurationTableDirective,
  ConfigurationTableFillDirective,
  ConfigurationTableRowActionsDirective,
  ConfigurationTableShareDirective,
  IconButtonComponent,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ChatStoreService } from "../../services/chat-store.service";
import { TimeFormatService } from "../../services/time-format.service";

@Component({
  selector: "nol-teamrun-computer-use-grants-view",
  imports: [ButtonComponent, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective, ConfigurationTableRowActionsDirective,
    ConfigurationTableShareDirective, IconButtonComponent, TooltipDirective],
  providers: [ChatStoreService.provider],
  templateUrl: "./computer-use-grants-view.component.html",
  styleUrls: ["../settings-view.css", "../failure-row.css"]
})
export class ComputerUseGrantsViewComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly grants: WritableSignal<readonly ComputerUseGrant[] | null> = signal(null);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly brokenIcons: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly times: TimeFormatService = inject(TimeFormatService);

  public constructor() {
    void this.list();
  }

  protected appName(grant: ComputerUseGrant): string {
    if (Object.isNull(grant.app))
      return Resources.screenGrantName;
    return grant.appName ?? (grant.app.split(Resources.appPathSeparators).at(-1) || grant.app);
  }

  protected iconOf(grant: ComputerUseGrant): string | null {
    return Object.isNull(grant.appIcon) || this.brokenIcons().has(grant.id) ? null : Resources.appIconSourcePrefix + grant.appIcon;
  }

  protected hideIcon(grant: ComputerUseGrant): void {
    this.brokenIcons.update(t => new Set(t).add(grant.id));
  }

  protected revokeLabel(grant: ComputerUseGrant): string {
    return Object.isNull(grant.app) ? Resources.revokeScreenGrantLabel : Resources.formatRowAction(Resources.revokeGrantLabel, this.appName(grant));
  }

  protected chatOf(grant: ComputerUseGrant): string {
    return Resources.formatGrantChat(grant.chatTitle, grant.teammateName);
  }

  protected grantedAt(grant: ComputerUseGrant): string {
    return this.times.dateTime(grant.grantedAt);
  }

  protected async revoke(grant: ComputerUseGrant): Promise<void> {
    const shown = await this.store.revokeComputerUseGrant(grant.id, t => this.error.set(t)) ? this.grants() : null;
    if (!Object.isNull(shown))
      this.grants.set(shown.filter(u => u.id !== grant.id));
    await this.list();
  }

  private async list(): Promise<void> {
    try {
      this.grants.set((await this.store.listComputerUseGrants()).toSorted((a, b) => a.grantedAt.localeCompare(b.grantedAt)));
    }
    catch (error) {
      this.grants.set([]);
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}
