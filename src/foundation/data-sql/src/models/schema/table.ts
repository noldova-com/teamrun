/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";
import type { Column } from "./column.js";
import type { ForeignKey } from "./foreign-key.js";
import type { PrimaryKey } from "./primary-key.js";

export class Table {
  public readonly name: string;
  public readonly columns: readonly Column[];
  public readonly primaryKey: PrimaryKey | null;
  public readonly foreignKeys: readonly ForeignKey[];

  public constructor(name: string, columns: readonly Column[], primaryKey: PrimaryKey | null, foreignKeys: readonly ForeignKey[]) {
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameParameterName);
    if (columns.length === 0)
      throw new ArgumentException(Resources.formatTableWithoutColumns(name), Resources.columnsParameterName);

    this.name = name;
    this.columns = [...columns];
    this.primaryKey = primaryKey;
    this.foreignKeys = [...foreignKeys];
  }
}
