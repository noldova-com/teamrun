/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


export class DetailFact {
  public readonly term: string;
  public readonly value: string;

  public constructor(term: string, value: string) {
    this.term = term;
    this.value = value;
  }
}
