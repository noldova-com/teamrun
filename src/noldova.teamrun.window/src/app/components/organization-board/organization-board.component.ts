/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, type InputSignal, input, output, type OutputEmitterRef, type Signal } from "@angular/core";

import type { Teammate } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, ChipComponent, IconButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import type { OrganizationNode } from "../../models/organization-node";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";

@Component({
  selector: "nol-teamrun-organization-board",
  imports: [ButtonComponent, ChipComponent, IconButtonComponent, OrganizationCardComponent],
  host: { class: "nol-teamrun-organization-board" },
  templateUrl: "./organization-board.component.html",
  styleUrl: "./organization-board.component.css"
})
export class OrganizationBoardComponent {
  public readonly tree: InputSignal<readonly OrganizationNode[]> = input.required<readonly OrganizationNode[]>();
  public readonly messageLeaders: OutputEmitterRef<void> = output<void>();
  public readonly messageDepartment: OutputEmitterRef<string> = output<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly row: OrganizationCardShape = OrganizationCardShape.Row;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly departments: Signal<readonly OrganizationNode[]> = computed(() => OrganizationBoardComponent.flatten(this.tree()));
  protected readonly leaders: Signal<readonly Teammate[]> = computed(() => this.departments().flatMap(t => Object.isNull(t.leader) ? [] : [t.leader]));

  private static flatten(nodes: readonly OrganizationNode[]): readonly OrganizationNode[] {
    return nodes.flatMap(t => [t, ...OrganizationBoardComponent.flatten(t.children)]);
  }
}
