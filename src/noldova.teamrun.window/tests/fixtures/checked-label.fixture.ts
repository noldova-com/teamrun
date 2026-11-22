/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CheckedLabel {
  public readonly label: string | null;
  public readonly checked: string | null;

  public constructor(label: string | null, checked: string | null) {
    this.label = label;
    this.checked = checked;
  }
}
