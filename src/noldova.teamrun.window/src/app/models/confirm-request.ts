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
  public readonly otherLabel: string | null;
  public readonly danger: boolean;

  public constructor(title: string, text: string, confirmLabel: string, otherLabel: string | null = null, danger: boolean = false) {
    this.title = title;
    this.text = text;
    this.confirmLabel = confirmLabel;
    this.otherLabel = otherLabel;
    this.danger = danger;
  }
}
