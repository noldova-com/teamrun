/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WorkFolder {
  public readonly id: string;
  public readonly path: string;

  public constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}
