/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";

import { ForeignKey } from "../../models/schema/foreign-key.js";
import { PrimaryKey } from "../../models/schema/primary-key.js";
import type { ColumnSelector } from "../../types/column-selector.js";

export class ConstraintsBuilder<TModel> {
  private key: PrimaryKey | null = null;
  private readonly foreignKeys: ForeignKey[] = [];

  public primaryKey(...columns: readonly ColumnSelector<TModel>[]): this {
    this.key = new PrimaryKey(columns.map(t => nameof<TModel>(t)));
    return this;
  }

  public foreignKey<TPrincipal>(column: ColumnSelector<TModel>, principalTable: string, principalColumn: ColumnSelector<TPrincipal>): this {
    this.foreignKeys.push(new ForeignKey(nameof<TModel>(column), principalTable, nameof<TPrincipal>(principalColumn)));
    return this;
  }

  public toPrimaryKey(): PrimaryKey | null {
    return this.key;
  }

  public toForeignKeys(): readonly ForeignKey[] {
    return [...this.foreignKeys];
  }
}
