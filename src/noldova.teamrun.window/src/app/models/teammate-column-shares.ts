/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TeammateColumnShares {
  public readonly name: number;
  public readonly connection: number;
  public readonly model: number;
  public readonly effort: number;
  public readonly actions: number;

  public constructor(name: number, connection: number, model: number, effort: number, actions: number) {
    this.name = name;
    this.connection = connection;
    this.model = model;
    this.effort = effort;
    this.actions = actions;
  }
}
