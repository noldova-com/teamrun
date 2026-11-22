/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConfirmCase {
  public readonly answer: string;
  public readonly button: string;
  public readonly kept: string | null;

  public constructor(answer: string, button: string, kept: string | null) {
    this.answer = answer;
    this.button = button;
    this.kept = kept;
  }
}
