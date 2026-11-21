/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Department, NameOrder, type Organization, type Teammate } from "@noldova/teamrun.protocol";

export class OrganizationNode {
  public readonly department: Department;
  public readonly leader: Teammate | null;
  public readonly members: readonly Teammate[];
  public readonly children: readonly OrganizationNode[];
  public readonly headcount: number;
  public readonly hidden: number;

  public constructor(department: Department, leader: Teammate | null, members: readonly Teammate[], children: readonly OrganizationNode[]) {
    this.department = department;
    this.leader = leader;
    this.members = members;
    this.children = children;
    this.headcount = (Object.isNull(leader) ? 0 : 1) + members.length;
    this.hidden = children.reduce((sum, t) => sum + t.headcount + t.hidden, members.length);
  }

  public static treeOf(organization: Organization, teammates: readonly Teammate[]): readonly OrganizationNode[] {
    const byId = new Map(teammates.map(t => [t.id, t]));
    const nodesOf = (parentId: string | null): readonly OrganizationNode[] => organization.childrenOf(parentId).map(department => {
      const leader = Object.isNull(department.leaderId) ? null : byId.get(department.leaderId) ?? null;
      const members = organization.members.filter(t => t.departmentId === department.id && t.teammateId !== department.leaderId)
        .flatMap(t => byId.get(t.teammateId) ?? []);
      return new OrganizationNode(department, leader, NameOrder.sort(members, t => t.name), nodesOf(department.id));
    });
    return nodesOf(null);
  }

  public static departmentsOf(organization: Organization, parentId: string | null = null): readonly Department[] {
    return organization.childrenOf(parentId).flatMap(t => [t, ...OrganizationNode.departmentsOf(organization, t.id)]);
  }
}
