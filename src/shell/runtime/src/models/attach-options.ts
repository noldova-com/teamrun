/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AttachOptions {
  public readonly start: boolean;
  public readonly takeOver: boolean;

  public constructor(start: boolean = true, takeOver: boolean = true) {
    this.start = start;
    this.takeOver = takeOver;
  }
}
