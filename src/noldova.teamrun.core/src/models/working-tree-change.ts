/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WorkingTreeChange {
  public readonly path: string;
  public readonly kind: string;
  public readonly diff: string | null;

  public constructor(path: string, kind: string, diff: string | null) {
    this.path = path;
    this.kind = kind;
    this.diff = diff;
  }
}
