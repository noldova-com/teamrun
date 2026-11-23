/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, ElementRef, inject, input, type InputSignal, output, type OutputEmitterRef, type Signal, viewChild } from "@angular/core";

import type { Department } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, DialogService, IconButtonComponent, SelectComponent, SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationEdits } from "../../models/organization-edits";
import { OrganizationPlaceChoice } from "../../models/organization-place-choice";
import { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { OrganizationTypeChoiceComponent } from "../organization-type-choice/organization-type-choice.component";
import { OrganizationTypeIconComponent } from "../organization-type-icon/organization-type-icon.component";

@Component({
  selector: "nol-teamrun-organization-unit-editor",
  imports: [ButtonComponent, IconButtonComponent, OrganizationTypeChoiceComponent, OrganizationTypeIconComponent, SelectComponent, TextFieldComponent],
  providers: [ChatStoreService.provider, OrganizationStoreService.provider],
  host: { class: "nol-teamrun-organization-unit-editor" },
  templateUrl: "./organization-unit-editor.component.html",
  styleUrls: ["../settings-dialog.css", "./organization-unit-editor.component.css"]
})
export class OrganizationUnitEditorComponent {
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly nameField: Signal<ElementRef<HTMLInputElement>> = viewChild.required<string, ElementRef<HTMLInputElement>>("name", { read: ElementRef });

  public readonly node: InputSignal<OrganizationNode> = input.required<OrganizationNode>();

  public readonly closed: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly leaderOptions: Signal<readonly SelectOption[]> = computed(() => OrganizationEdits.leaderOptions(this.node(), this.store.teammates()));
  protected readonly placeChoices: Signal<readonly OrganizationPlaceChoice[]> = computed(() =>
    OrganizationPlaceChoice.of(OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()), this.node().key));
  protected readonly placeOptions: Signal<readonly SelectOption[]> = computed(() => this.placeChoices().map(t => new SelectOption(t.key, t.label)));

  protected placeKeyOf(department: Department): string {
    return OrganizationPlaceChoice.keyOf(department.parent);
  }

  protected rename(department: Department): void {
    const field = this.nameField().nativeElement;
    const name = field.value.trim();
    if (name.length === 0 || name === department.name) {
      field.value = department.name;
      return;
    }
    void this.organization.renameDepartment(department.id, name);
  }

  protected setLeader(value: string): void {
    void OrganizationEdits.setLeaderAsync(this.organization, this.node(), value);
  }

  protected move(department: Department, key: string): void {
    for (const choice of this.placeChoices().filter(t => t.key === key))
      void this.organization.moveDepartment(department.id, choice.parent);
  }

  protected confirmDelete(department: Department): void {
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", OrganizationEdits.deleteRequest(department, this.organization.organization().typeOf(department.id),
      [...this.organization.organization().departments, ...this.store.teammates()]));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void this.organization.deleteDepartment(department.id);
    });
  }
}
