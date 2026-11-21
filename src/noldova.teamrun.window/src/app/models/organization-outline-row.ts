/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Teammate } from "@noldova/teamrun.protocol";

import type { OrganizationNode } from "./organization-node";

export class OrganizationOutlineRow {
  public readonly node: OrganizationNode;
  public readonly depth: number;
  public readonly people: readonly Teammate[];

  public constructor(node: OrganizationNode, depth: number) {
    this.node = node;
    this.depth = depth;
    this.people = [...Object.isNull(node.leader) ? [] : [node.leader], ...node.members];
  }
}
