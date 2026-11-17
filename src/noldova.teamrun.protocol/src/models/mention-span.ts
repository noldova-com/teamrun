/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TeammateMention } from "./teammate-mention.js";

export class MentionSpan {
  public readonly mention: TeammateMention;
  public readonly start: number;
  public readonly end: number;

  public constructor(mention: TeammateMention, start: number, end: number) {
    this.mention = mention;
    this.start = start;
    this.end = end;
  }
}
