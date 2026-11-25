/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CursorReleaseTarget {
  public readonly target: string;
  public readonly path: string;
  public readonly sha256: string;
  public readonly archiveBytes: number;
  public readonly nodeBytes: number;
  public readonly scriptBytes: number;

  public constructor(target: string, path: string, sha256: string, archiveBytes: number, nodeBytes: number, scriptBytes: number) {
    this.target = target;
    this.path = path;
    this.sha256 = sha256;
    this.archiveBytes = archiveBytes;
    this.nodeBytes = nodeBytes;
    this.scriptBytes = scriptBytes;
  }
}
