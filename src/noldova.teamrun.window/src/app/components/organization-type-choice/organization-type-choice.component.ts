/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";
import type { Department } from "@noldova/teamrun.protocol";
import { DialogService, SelectComponent, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationTypeDialogComponent } from "../organization-type-dialog/organization-type-dialog.component";

@Component({
  selector: "nol-teamrun-organization-type-choice",
  imports: [SelectComponent],
  templateUrl: "./organization-type-choice.component.html",
  styleUrl: "./organization-type-choice.component.css"
})
export class OrganizationTypeChoiceComponent {
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => [
    ...this.organization.organization().nodeTypes.map(t => new SelectOption(t.id, t.name)),
    new SelectOption(Resources.organizationNewTypeValue, Resources.organizationNewTypeOption)
  ]);

  public readonly department: InputSignal<Department> = input.required<Department>();

  protected choose(value: string): void {
    const department = this.department();
    if (value !== Resources.organizationNewTypeValue) {
      void this.organization.setDepartmentType(department.id, value);
      return;
    }
    OrganizationTypeDialogComponent.open(this.dialogs, this.organization, null)?.created.subscribe(t => void this.organization.setDepartmentType(department.id, t.id));
  }
}
