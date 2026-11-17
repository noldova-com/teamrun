/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RenamedJsonField {
  public readonly table: string;
  public readonly entity: string;
  public readonly from: string;
  public readonly to: string;
  public readonly name: string | null;

  public constructor(table: string, entity: string, from: string, to: string, name: string | null = null) {
    this.table = table;
    this.entity = entity;
    this.from = from;
    this.to = to;
    this.name = name;
  }
}
