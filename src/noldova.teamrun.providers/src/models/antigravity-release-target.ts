/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AntigravityReleaseTarget {
  public readonly target: string;
  public readonly file: string;
  public readonly sha256: string;
  public readonly archiveBytes: number;
  public readonly executableBytes: number;
  public readonly harnessBytes: number;

  public constructor(target: string, file: string, sha256: string, archiveBytes: number, executableBytes: number, harnessBytes: number) {
    this.target = target;
    this.file = file;
    this.sha256 = sha256;
    this.archiveBytes = archiveBytes;
    this.executableBytes = executableBytes;
    this.harnessBytes = harnessBytes;
  }
}
