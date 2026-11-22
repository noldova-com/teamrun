/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PaceCase {
  public readonly pace: string;
  public readonly loadedFrame: number;

  public constructor(pace: string, loadedFrame: number) {
    this.pace = pace;
    this.loadedFrame = loadedFrame;
  }
}
