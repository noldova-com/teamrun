/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Department, NameOrder, type NodeType, type Teammate } from "@noldova/teamrun.protocol";
import { SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import type { INamedParent } from "../interfaces/i-named-parent";
import { ConfirmRequest } from "./confirm-request";
import type { OrganizationStoreService } from "../services/organization-store.service";
import type { OrganizationNode } from "./organization.node";

export class OrganizationEdits {
  public static leaderOptions(node: OrganizationNode, teammates: readonly Teammate[]): readonly SelectOption[] {
    const people = NameOrder.sort(Object.isNull(node.leader) ? node.members : [node.leader, ...node.members], t => t.name);
    const others = NameOrder.sort(teammates.filter(t => !people.some(u => u.id === t.id)), t => t.name);
    return [new SelectOption(String.empty, Resources.organizationNoLeader), ...[...people, ...others].map(t => new SelectOption(t.id, t.name))];
  }

  public static async setLeaderAsync(organization: OrganizationStoreService, node: OrganizationNode, value: string): Promise<void> {
    await organization.setLeader(node.id, value.length === 0 ? null : value);
  }

  public static deleteRequest(department: Department, type: NodeType | null, parents: readonly INamedParent[]): ConfirmRequest {
    const parent = parents.find(t => t.id === department.parent.id)?.name ?? null;
    return new ConfirmRequest(Resources.formatOrganizationDeleteUnit(type), Resources.formatOrganizationDeleteDepartment(department.name, parent),
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
