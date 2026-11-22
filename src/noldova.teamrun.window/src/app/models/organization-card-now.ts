/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OrganizationCardNow {
  public readonly icon: string;
  public readonly text: string;
  public readonly lasted: string | null;

  public constructor(icon: string, text: string, lasted: string | null) {
    this.icon = icon;
    this.text = text;
    this.lasted = lasted;
  }
}
