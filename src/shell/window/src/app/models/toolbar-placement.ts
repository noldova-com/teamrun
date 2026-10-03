/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources";

export class ToolbarPlacement {
  public readonly isShown: boolean;
  public readonly after: string | null;
  public readonly before: string | null;
  public readonly startsRow: boolean;

  public constructor(isShown: boolean = true, after: string | null = null, before: string | null = null, startsRow: boolean = false) {
    if (!Object.isNull(after) && !Object.isNull(before) || startsRow && !(Object.isNull(after) && Object.isNull(before)))
      throw new ArgumentException(Resources.severalToolbarPositions, Resources.afterParameter);

    this.isShown = isShown;
    this.after = after;
    this.before = before;
    this.startsRow = startsRow;
  }
}
