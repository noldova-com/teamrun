/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FoundMock {
  public readonly index: number;
  public readonly form: string;
  public readonly module: string | null;

  public constructor(index: number, form: string, module: string | null) {
    this.index = index;
    this.form = form;
    this.module = module;
  }
}
