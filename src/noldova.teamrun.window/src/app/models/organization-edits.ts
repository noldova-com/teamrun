/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NameOrder, type Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ConfirmRequest } from "./confirm-request";
import type { OrganizationNode } from "./organization.node";

export class OrganizationEdits {
  public static addable(node: OrganizationNode, teammates: readonly Teammate[]): readonly Teammate[] {
    const inside = new Set([...Object.isNull(node.leader) ? [] : [node.leader.id], ...node.members.map(t => t.id)]);
    return NameOrder.sort(teammates.filter(t => !inside.has(t.id)), t => t.name);
  }

  public static deleteRequest(node: OrganizationNode, nodes: readonly OrganizationNode[]): ConfirmRequest {
    const parent = nodes.find(t => t.department.id === node.department.parentId)?.department.name ?? null;
    return new ConfirmRequest(Resources.organizationDeleteDepartmentTitle, Resources.formatOrganizationDeleteDepartment(node.department.name, parent),
      Resources.organizationDeleteLabel, null, true);
  }

  public static nameOf(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value.trim() : String.empty;
  }
}
