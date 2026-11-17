/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DenyingTurn } from "../enums/denying-turn.js";
import { Resources } from "../resources.js";
import { CoreException } from "./core.exception.js";

export class ApprovalNotDeniableException extends CoreException {
  public override readonly name: string = "ApprovalNotDeniableException";
  public readonly turn: DenyingTurn;
  public readonly summary: string;

  public constructor(turn: DenyingTurn, summary: string) {
    super(ApprovalNotDeniableException.describe(turn, summary));
    this.turn = turn;
    this.summary = summary;
  }

  private static describe(turn: DenyingTurn, summary: string): string {
    switch (turn) {
      case DenyingTurn.Explorer:
        return Resources.formatExplorerDenied(summary);
      case DenyingTurn.Title:
        return Resources.titleTurnNotDeniable;
      case DenyingTurn.Summary:
        return Resources.summaryTurnNotDeniable;
    }
  }
}
