/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ArtifactLine {
  public readonly icon: string;
  public readonly text: string;

  public constructor(icon: string, text: string) {
    this.icon = icon;
    this.text = text;
  }
}
