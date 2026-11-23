/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FoundServer {
  public readonly path: string;
  public readonly stamp: number;
  public readonly version: string | null;

  public constructor(path: string, stamp: number, version: string | null) {
    this.path = path;
    this.stamp = stamp;
    this.version = version;
  }
}
