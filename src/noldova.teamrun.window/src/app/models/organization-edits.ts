/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Department, NameOrder, type Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ConfirmRequest } from "./confirm-request";
import type { OrganizationNode } from "./organization.node";

export class OrganizationEdits {
  public static addable(node: OrganizationNode, teammates: readonly Teammate[]): readonly Teammate[] {
    const inside = new Set([...Object.isNull(node.leader) ? [] : [node.leader.id], ...node.members.map(t => t.id)]);
    return NameOrder.sort(teammates.filter(t => !inside.has(t.id)), t => t.name);
  }

  public static deleteRequest(department: Department, nodes: readonly OrganizationNode[]): ConfirmRequest {
    const parent = nodes.find(t => t.department?.id === department.parentId)?.name ?? null;
    return new ConfirmRequest(Resources.organizationDeleteDepartmentTitle, Resources.formatOrganizationDeleteDepartment(department.name, parent),
      Resources.organizationDeleteLabel, null, true);
  }

  public static async renameAsync(event: Event, stored: string, rename: (name: string) => Promise<boolean>): Promise<void> {
    const field = event.target;
    if (!(field instanceof HTMLInputElement))
      return;
    const name = field.value.trim();
    if (name === stored)
      return;
    if (name.length === 0 || !await rename(name))
      field.value = stored;
  }
}
