/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import type { StatusBarSide } from "../enums/status-bar-side";
import type { StatusBarItemState } from "./status-bar-item-state";
import { Resources } from "../../resources";

export class StatusBarItemContribution {
  public readonly name: string;
  public readonly side: StatusBarSide;
  public readonly state: StatusBarItemState;

  public constructor(name: string, side: StatusBarSide, state: StatusBarItemState) {
    this.name = QualifiedName.parse(name, Resources.nameParameter).text;
    this.side = side;
    this.state = state;
  }
}
