/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ApprovalGroup {
  public readonly key: number;
  public readonly ids: readonly string[];

  public constructor(key: number, ids: readonly string[]) {
    this.key = key;
    this.ids = ids;
  }
}
