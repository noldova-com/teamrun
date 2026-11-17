/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CheckpointRestore {
  public readonly files: number | null;
  public readonly refusal: string | null;

  private constructor(files: number | null, refusal: string | null) {
    this.files = files;
    this.refusal = refusal;
  }

  public static restored(files: number): CheckpointRestore {
    return new CheckpointRestore(files, null);
  }

  public static refused(refusal: string): CheckpointRestore {
    return new CheckpointRestore(null, refusal);
  }
}
