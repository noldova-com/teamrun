/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConfirmRequest {
  public readonly title: string;
  public readonly text: string;
  public readonly confirmLabel: string;

  public constructor(title: string, text: string, confirmLabel: string) {
    this.title = title;
    this.text = text;
    this.confirmLabel = confirmLabel;
  }
}
