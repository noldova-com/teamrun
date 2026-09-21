/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";

export class ForeignKey {
  public readonly column: string;
  public readonly principalTable: string;
  public readonly principalColumn: string;

  public constructor(column: string, principalTable: string, principalColumn: string) {
    ArgumentException.throwIfNullOrWhitespace(column, Resources.columnParameterName);
    ArgumentException.throwIfNullOrWhitespace(principalTable, Resources.principalTableParameterName);
    ArgumentException.throwIfNullOrWhitespace(principalColumn, Resources.principalColumnParameterName);

    this.column = column;
    this.principalTable = principalTable;
    this.principalColumn = principalColumn;
  }
}
