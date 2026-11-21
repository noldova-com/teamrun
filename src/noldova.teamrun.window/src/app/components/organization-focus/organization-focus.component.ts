/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";

import { WindowPartTokens } from "@noldova/desktop.window";
import { OrganizationTarget, type Teammate } from "@noldova/teamrun.protocol";
import { ChipComponent, IconButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import { TeammateStatus } from "../../enums/teammate-status";
import { OrganizationBoardAsk } from "../../models/organization-board-ask";
import { OrganizationCrumb } from "../../models/organization-crumb";
import { OrganizationFocus } from "../../models/organization-focus";
import type { OrganizationNode } from "../../models/organization-node";
import { OrganizationOutlineRow } from "../../models/organization-outline-row";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";

@Component({
  selector: "nol-teamrun-organization-focus",
  imports: [ChipComponent, IconButtonComponent, OrganizationCardComponent],
  host: { class: "nol-teamrun-organization-focus" },
  templateUrl: "./organization-focus.component.html",
  styleUrl: "./organization-focus.component.css"
})
export class OrganizationFocusComponent {
  private readonly statuses: TeammateStatusStoreService = TeammateStatusStoreService.of(inject(WindowPartTokens.context));

  public readonly tree: InputSignal<readonly OrganizationNode[]> = input.required<readonly OrganizationNode[]>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly fluid: OrganizationCardShape = OrganizationCardShape.Fluid;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly rows: Signal<readonly OrganizationOutlineRow[]> = computed(() => OrganizationFocusComponent.flatten(this.tree(), 0));
  protected readonly headcount: Signal<number> = computed(() => this.rows().reduce((total, t) => total + t.node.headcount, 0));
  protected readonly focus: Signal<OrganizationFocus> = computed(() => OrganizationFocus.resolve(this.tree(), this.layout.layout().focus));
  protected readonly key: Signal<string> = computed(() => OrganizationFocus.keyOf(this.focus().target));
  protected readonly leaders: Signal<readonly Teammate[]> = computed(() => this.rows().flatMap(t => Object.isNull(t.node.leader) ? [] : [t.node.leader]));
  protected readonly cards: Signal<readonly Teammate[]> = computed(() => {
    const focus = this.focus();
    if (!Object.isNull(focus.teammate))
      return [focus.teammate];
    const department = focus.department;
    return Object.isNull(department) ? this.leaders() : [...Object.isNull(department.leader) ? [] : [department.leader], ...department.members];
  });
  protected readonly crumbs: Signal<readonly OrganizationCrumb[]> = computed(() => {
    const focus = this.focus();
    const here = this.key();
    const trail = [new OrganizationCrumb(Resources.organizationTitle, OrganizationTarget.leaders, false), ...focus.path.map(t => new OrganizationCrumb(t.department.name, OrganizationTarget.department(t.department.id), false)),
      ...Object.isNull(focus.teammate) ? [] : [new OrganizationCrumb(focus.teammate.name, OrganizationTarget.teammate(focus.teammate.id), false)]];
    return trail.map(t => new OrganizationCrumb(t.label, t.target, OrganizationFocus.keyOf(t.target) === here));
  });
  protected readonly unitName: Signal<string> = computed(() => this.focus().teammate?.name ?? this.focus().department?.department.name ?? Resources.organizationTitle);
  protected readonly unitSummary: Signal<string> = computed(() => {
    const focus = this.focus();
    const department = focus.department;
    if (!Object.isNull(focus.teammate))
      return Resources.formatOrganizationFocusTeammate(focus.teammate.role, department?.department.name ?? String.empty, focus.teammate.model);
    const counts = this.countsOf(this.cards());
    return Object.isNull(department) ? Resources.formatOrganizationFocusLeaders(this.cards().length, counts) : Resources.formatOrganizationFocusDepartment(this.cards().length, counts);
  });

  protected status(teammate: Teammate): TeammateStatus {
    return this.statuses.statusOf(teammate.id)();
  }

  protected asksIn(row: OrganizationOutlineRow): number {
    return row.people.filter(t => OrganizationBoardAsk.needsYou(this.status(t))).length;
  }

  protected isHere(target: OrganizationTarget): boolean {
    return OrganizationFocus.keyOf(target) === this.key();
  }

  protected go(target: OrganizationTarget): void {
    this.layout.focusOn(OrganizationFocus.keyOf(target));
  }

  protected department(row: OrganizationOutlineRow): OrganizationTarget {
    return OrganizationTarget.department(row.node.department.id);
  }

  protected teammate(teammate: Teammate): OrganizationTarget {
    return OrganizationTarget.teammate(teammate.id);
  }

  protected rootTarget(): OrganizationTarget {
    return OrganizationTarget.leaders;
  }

  private countsOf(teammates: readonly Teammate[]): ReadonlyMap<TeammateStatus, number> {
    const counts = new Map<TeammateStatus, number>();
    for (const teammate of teammates)
      counts.set(this.status(teammate), (counts.get(this.status(teammate)) ?? 0) + 1);
    return counts;
  }

  private static flatten(nodes: readonly OrganizationNode[], depth: number): readonly OrganizationOutlineRow[] {
    return nodes.flatMap(t => [new OrganizationOutlineRow(t, depth), ...OrganizationFocusComponent.flatten(t.children, depth + 1)]);
  }
}
