/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Department, NameOrder, type Organization, type Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class OrganizationNode {
  public static readonly unplacedId: string = "no-department";

  public readonly department: Department | null;
  public readonly leader: Teammate | null;
  public readonly members: readonly Teammate[];
  public readonly children: readonly OrganizationNode[];
  public readonly headcount: number;
  public readonly total: number;
  public readonly hidden: number;

  private constructor(department: Department | null, leader: Teammate | null, members: readonly Teammate[],
    children: readonly OrganizationNode[]) {
    this.department = department;
    this.leader = leader;
    this.members = members;
    this.children = children;
    this.headcount = (Object.isNull(leader) ? 0 : 1) + members.length;
    const nested = children.reduce((sum, t) => sum + t.total, 0);
    this.total = this.headcount + nested;
    this.hidden = members.length + nested;
  }

  public get id(): string {
    return this.department?.id ?? OrganizationNode.unplacedId;
  }

  public get name(): string {
    return this.department?.name ?? Resources.organizationNoDepartment;
  }

  public get isUnplaced(): boolean {
    return Object.isNull(this.department);
  }

  public static treeOf(organization: Organization, teammates: readonly Teammate[]): readonly OrganizationNode[] {
    const byId = new Map(teammates.map(t => [t.id, t]));
    const nodesOf = (parentId: string | null): readonly OrganizationNode[] => organization.childrenOf(parentId).map(department => {
      const leader = Object.isNull(department.leaderId) ? null : byId.get(department.leaderId) ?? null;
      const members = organization.members.filter(t => t.departmentId === department.id && t.teammateId !== department.leaderId)
        .flatMap(t => byId.get(t.teammateId) ?? []);
      return new OrganizationNode(department, leader, NameOrder.sort(members, t => t.name), nodesOf(department.id));
    });
    const placed = new Set(organization.members.map(t => t.teammateId));
    const unplaced = NameOrder.sort(teammates.filter(t => !placed.has(t.id)), t => t.name);
    return [...unplaced.length === 0 ? [] : [new OrganizationNode(null, null, unplaced, [])], ...nodesOf(null)];
  }

  public static departmentsOf(organization: Organization, parentId: string | null = null): readonly Department[] {
    return organization.childrenOf(parentId).flatMap(t => [t, ...OrganizationNode.departmentsOf(organization, t.id)]);
  }
}
