/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ReleaseBody {
  public readonly path: string;
  public readonly body: Buffer;

  public constructor(path: string, body: Buffer) {
    this.path = path;
    this.body = body;
  }
}
