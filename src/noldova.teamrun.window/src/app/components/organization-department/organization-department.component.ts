/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";

import { ChipComponent, IconButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { OrganizationNode } from "../../models/organization-node";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";

@Component({
  selector: "nol-teamrun-organization-department",
  imports: [ChipComponent, IconButtonComponent, OrganizationCardComponent],
  providers: [OrganizationLayoutService.provider],
  host: { class: "nol-teamrun-organization-department" },
  templateUrl: "./organization-department.component.html",
  styleUrls: ["../organization-tree.css", "./organization-department.component.css"]
})
export class OrganizationDepartmentComponent {
  private readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);

  public readonly node: InputSignal<OrganizationNode> = input.required<OrganizationNode>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly isOpen: Signal<boolean> = computed(() => !this.layout.layout().isCollapsed(this.node().department.id));
  protected readonly summary: Signal<string> = computed(() =>
    Resources.formatOrganizationDepartmentSummary(this.node().leader?.name ?? null, this.node().members.length));

  protected toggle(): void {
    this.layout.toggleDepartment(this.node().department.id);
  }
}
