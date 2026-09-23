/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReplySummary } from "@noldova/teamrun-protocol";

import { ReplyExpansion } from "./reply-expansion";

export class ReplyHistoryItem {
  public readonly summary: ReplySummary;
  public readonly expansion: ReplyExpansion;

  public constructor(summary: ReplySummary, expansion: ReplyExpansion = new ReplyExpansion()) {
    this.summary = summary;
    this.expansion = expansion;
  }
}
