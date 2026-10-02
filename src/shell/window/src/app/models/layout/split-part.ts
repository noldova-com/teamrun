/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LayoutNode } from "./layout.node";

export class SplitPart {
  public readonly node: LayoutNode;
  public readonly weight: number;

  public constructor(node: LayoutNode, weight: number) {
    this.node = node;
    this.weight = weight;
  }
}
