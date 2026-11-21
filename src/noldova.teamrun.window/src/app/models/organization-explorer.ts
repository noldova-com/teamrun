/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { NameOrder, type Organization, type Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { OrganizationNode } from "./organization.node";

export class OrganizationExplorerDepartment {
  public readonly id: string;
  public readonly path: string;
  public readonly teammates: readonly Teammate[];

  public constructor(id: string, path: string, teammates: readonly Teammate[]) {
    this.id = id;
    this.path = path;
    this.teammates = teammates;
  }
}

export class OrganizationExplorer {
  public readonly unplaced: readonly Teammate[];
  public readonly departments: readonly OrganizationExplorerDepartment[];

  private constructor(unplaced: readonly Teammate[], departments: readonly OrganizationExplorerDepartment[]) {
    this.unplaced = unplaced;
    this.departments = departments;
  }

  public static of(organization: Organization, teammates: readonly Teammate[]): OrganizationExplorer {
    const tree = OrganizationNode.treeOf(organization, teammates);
    const departments: OrganizationExplorerDepartment[] = [];
    const visit = (node: OrganizationNode, path: readonly string[]): void => {
      const names = [...path, node.name];
      departments.push(new OrganizationExplorerDepartment(node.id, names.join(Resources.departmentPathSeparator),
        NameOrder.sort([...Object.isNull(node.leader) ? [] : [node.leader], ...node.members], t => t.name)));
      for (const child of node.children)
        visit(child, names);
    };
    for (const node of tree.filter(t => !t.isUnplaced))
      visit(node, []);
    return new OrganizationExplorer(tree.filter(t => t.isUnplaced).flatMap(t => t.members), departments);
  }
}
