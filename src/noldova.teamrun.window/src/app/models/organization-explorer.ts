/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { NameOrder, type Organization, OrganizationNodeKind, OrganizationParent, type Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { OrganizationExplorerDepartment } from "./organization-explorer-department";

export class OrganizationExplorer {
  public readonly id: string;
  public readonly name: string;
  public readonly key: string;
  public readonly teammates: readonly Teammate[];
  public readonly departments: readonly OrganizationExplorerDepartment[];

  private constructor(organization: Organization, teammates: readonly Teammate[], departments: readonly OrganizationExplorerDepartment[]) {
    this.id = organization.id;
    this.name = organization.name;
    this.key = Resources.formatOrganizationExplorerKey(organization.id);
    this.teammates = teammates;
    this.departments = departments;
  }

  public get isEmpty(): boolean {
    return this.teammates.length === 0 && this.departments.length === 0;
  }

  public static of(organization: Organization, teammates: readonly Teammate[]): OrganizationExplorer {
    const unplaced = organization.unplaced(teammates.map(t => t.id));
    const teammatesIn = (departmentId: string | null): readonly Teammate[] =>
      NameOrder.sort(teammates.filter(t => !unplaced.includes(t.id) && organization.departmentOf(t.id) === departmentId), t => t.name);
    const departments: OrganizationExplorerDepartment[] = [];
    const visit = (parent: OrganizationParent, path: readonly string[]): void => {
      for (const child of organization.childrenOf(parent)) {
        const department = child.kind === OrganizationNodeKind.Department ? organization.departments.find(t => t.id === child.id) : undefined;
        const names = Object.isUndefined(department) ? path : [...path, department.name];
        if (!Object.isUndefined(department))
          departments.push(new OrganizationExplorerDepartment(department.id, names.join(Resources.departmentPathSeparator), teammatesIn(department.id)));
        visit(child, names);
      }
    };
    visit(OrganizationParent.person, []);
    return new OrganizationExplorer(organization, teammatesIn(null), departments);
  }
}
