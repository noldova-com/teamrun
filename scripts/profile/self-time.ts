/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProfileNode } from "./profile.node.ts";

export class SelfTime {
  public readonly node: ProfileNode;
  public readonly milliseconds: number;
  public readonly callers: readonly ProfileNode[];

  public constructor(node: ProfileNode, milliseconds: number, callers: readonly ProfileNode[]) {
    this.node = node;
    this.milliseconds = milliseconds;
    this.callers = callers;
  }
}
