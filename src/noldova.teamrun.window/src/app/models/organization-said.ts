/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OrganizationSaid {
  public readonly text: string;
  public readonly ago: string;

  public constructor(text: string, ago: string) {
    this.text = text;
    this.ago = ago;
  }
}
