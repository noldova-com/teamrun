/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GrokReleaseTarget {
  public readonly target: string;
  public readonly file: string;
  public readonly sha256: string;
  public readonly archiveBytes: number;
  public readonly program: string;
  public readonly programBytes: number;

  public constructor(target: string, file: string, sha256: string, archiveBytes: number, program: string, programBytes: number) {
    this.target = target;
    this.file = file;
    this.sha256 = sha256;
    this.archiveBytes = archiveBytes;
    this.program = program;
    this.programBytes = programBytes;
  }
}
