/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StartedProgram {
  private readonly end: () => void;

  public constructor(end: () => void) {
    this.end = end;
  }

  public stop(): void {
    this.end();
  }
}
