/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Department, NameOrder, type NodeType, type Organization, OrganizationNodeKind, OrganizationParent, type Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class OrganizationNode {
  private static readonly fewestColumns: number = 4;
  public readonly key: OrganizationParent;
  public readonly department: Department | null;
  public readonly type: NodeType | null;
  public readonly teammate: Teammate | null;
  public readonly leader: Teammate | null;
  public readonly departments: readonly OrganizationNode[];
  public readonly reports: readonly OrganizationNode[];
  public readonly members: readonly Teammate[];
  public readonly directReports: readonly Teammate[];
  public readonly managers: ReadonlyMap<string, Teammate>;
  public readonly headcount: number;
  public readonly total: number;
  public readonly hidden: number;
  private readonly self: readonly Teammate[];
  private readonly people: readonly Teammate[];

  private constructor(key: OrganizationParent, department: Department | null, type: NodeType | null, teammate: Teammate | null, leader: Teammate | null,
    departments: readonly OrganizationNode[], reports: readonly OrganizationNode[]) {
    this.key = key;
    this.department = department;
    this.type = type;
    this.teammate = teammate;
    this.leader = leader;
    this.departments = departments;
    this.reports = reports;
    this.self = Object.isNull(teammate) ? [] : [teammate];
    this.people = [...this.self, ...reports.flatMap(t => t.people)];
    this.members = NameOrder.sort(reports.flatMap(t => t.people), t => t.name);
    this.directReports = reports.flatMap(t => t.self);
    this.managers = OrganizationNode.managersOf(reports);
    this.headcount = (Object.isNull(leader) ? 0 : 1) + this.members.length;
    const nested = [...departments, ...reports.flatMap(t => t.subDepartments)].reduce((sum, t) => sum + t.total, 0);
    this.total = this.headcount + nested;
    this.hidden = this.total;
  }

  public get id(): string {
    return this.key.id ?? Resources.organizationPersonId;
  }

  public get name(): string {
    return this.department?.name ?? this.teammate?.name ?? Resources.organizationOwnerName;
  }

  public get children(): readonly OrganizationNode[] {
    return [...this.departments, ...this.reports];
  }

  public get subDepartments(): readonly OrganizationNode[] {
    return [...this.departments, ...this.reports.flatMap(t => t.subDepartments)];
  }

  public get columns(): number {
    return Math.max(1, Math.min(this.reports.length, Math.max(OrganizationNode.fewestColumns, Math.ceil(Math.sqrt(this.reports.length)))));
  }

  public static treeOf(organization: Organization, teammates: readonly Teammate[]): OrganizationNode {
    const nodesUnder = (parent: OrganizationParent): readonly OrganizationNode[] => organization.childrenOf(parent).flatMap(key => {
      if (key.kind === OrganizationNodeKind.Department)
        return organization.departments.filter(t => key.equals(OrganizationParent.department(t.id))).map(t => departmentNode(t));
      const teammate = teammates.find(t => key.equals(OrganizationParent.teammate(t.id)));
      return Object.isUndefined(teammate) ? nodesUnder(key) : [OrganizationNode.of(key, null, null, teammate, null, nodesUnder(key))];
    });
    const departmentNode = (department: Department): OrganizationNode => {
      const key = OrganizationParent.department(department.id);
      const children = nodesUnder(key);
      const leaderNode = children.find(t => !Object.isNull(t.teammate) && t.teammate.id === department.leaderId) ?? null;
      const rest = children.filter(t => t !== leaderNode);
      return OrganizationNode.of(key, department, organization.typeOf(department.id), null, leaderNode?.teammate ?? null, [...rest, ...leaderNode?.children ?? []]);
    };
    return OrganizationNode.of(OrganizationParent.person, null, null, null, null, nodesUnder(OrganizationParent.person));
  }

  public static departmentsOf(organization: Organization, parent: OrganizationParent = OrganizationParent.person): readonly Department[] {
    const under = organization.departmentsUnder(parent);
    return organization.childrenOf(parent).flatMap(key => [...under.filter(t => key.equals(OrganizationParent.department(t.id))),
      ...OrganizationNode.departmentsOf(organization, key)]);
  }

  public static walk(node: OrganizationNode): readonly OrganizationNode[] {
    return [node, ...node.children.flatMap(t => OrganizationNode.walk(t))];
  }

  private static managersOf(reports: readonly OrganizationNode[]): ReadonlyMap<string, Teammate> {
    const managers = new Map<string, Teammate>();
    for (const report of reports) {
      for (const [id, manager] of report.managers)
        managers.set(id, manager);
      for (const manager of report.self)
        for (const person of report.directReports)
          managers.set(person.id, manager);
    }
    return managers;
  }

  private static of(key: OrganizationParent, department: Department | null, type: NodeType | null, teammate: Teammate | null, leader: Teammate | null,
    children: readonly OrganizationNode[]): OrganizationNode {
    return new OrganizationNode(key, department, type, teammate, leader, children.filter(t => !Object.isNull(t.department)),
      NameOrder.sort(children.filter(t => !Object.isNull(t.teammate)), t => t.name));
  }
}
