/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReplyExpansion } from "./reply-expansion";

export class ReplyIndexEntry {
  public readonly id: string;
  public readonly sequence: number;
  public expansion: ReplyExpansion | null = null;

  public constructor(id: string, sequence: number) {
    this.id = id;
    this.sequence = sequence;
  }

  public rememberExpansion(expansion: ReplyExpansion): void {
    this.expansion = expansion.hasChanges ? expansion : null;
  }
}
