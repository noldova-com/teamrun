/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type OutputEmitterRef, output, type Signal } from "@angular/core";
import type { NodeType } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, DialogComponent, DialogService, FieldMessageComponent, IconButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationTypeDialogComponent } from "../organization-type-dialog/organization-type-dialog.component";
import { OrganizationTypeIconComponent } from "../organization-type-icon/organization-type-icon.component";

@Component({
  selector: "nol-teamrun-organization-types-dialog",
  imports: [ButtonComponent, DialogComponent, FieldMessageComponent, IconButtonComponent, OrganizationTypeIconComponent],
  templateUrl: "./organization-types-dialog.component.html",
  styleUrls: ["../settings-dialog.css", "./organization-types-dialog.component.css"]
})
export class OrganizationTypesDialogComponent {
  private readonly dialogs: DialogService = inject(DialogService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly types: Signal<readonly NodeType[]> = computed(() => this.organization().organization().nodeTypes);
  protected readonly error: Signal<string | null> = computed(() => this.organization().actionError());

  public readonly organization: InputSignal<OrganizationStoreService> = input.required<OrganizationStoreService>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  public static open(dialogs: DialogService, organization: OrganizationStoreService): void {
    organization.clearActionError();
    const dialog = dialogs.open(OrganizationTypesDialogComponent, ".nol-teamrun-new-type");
    dialog.componentRef?.setInput("organization", organization);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected edit(type: NodeType | null): void {
    OrganizationTypeDialogComponent.open(this.dialogs, this.organization(), type);
  }

  protected remove(type: NodeType): void {
    void this.organization().deleteNodeType(type.id);
  }
}
