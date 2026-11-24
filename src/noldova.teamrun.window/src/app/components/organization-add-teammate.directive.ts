/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, inject, input, type InputSignal } from "@angular/core";
import type { OrganizationParent } from "@noldova/teamrun.protocol";
import { DialogService } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ChatStoreService } from "../services/chat-store.service";
import { OrganizationStoreService } from "../services/organization-store.service";
import { OrganizationAddTeammateDialogComponent } from "./organization-add-teammate-dialog/organization-add-teammate-dialog.component";

@Directive({
  selector: "[nolTeamrunAddTeammate]",
  providers: [ChatStoreService.provider, OrganizationStoreService.provider],
  host: { "(click)": "open()" }
})
export class OrganizationAddTeammateDirective {
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);

  public readonly parent: InputSignal<OrganizationParent> = input.required<OrganizationParent>({ alias: "nolTeamrunAddTeammate" });
  public readonly title: InputSignal<string> = input(Resources.organizationAddTeammate, { alias: "nolTeamrunAddTeammateTitle" });

  protected open(): void {
    OrganizationAddTeammateDialogComponent.open(this.dialogs, this.store, this.organization, this.parent(), this.title());
  }
}
