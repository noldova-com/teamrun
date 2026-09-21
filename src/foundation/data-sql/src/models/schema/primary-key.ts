/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class PrimaryKey {
  public readonly columns: readonly string[];

  public constructor(columns: readonly string[]) {
    if (columns.length === 0)
      throw new ArgumentException(Resources.keyWithoutColumns, Resources.columnsParameterName);

    this.columns = [...columns];
  }
}
