/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WakeCase {
  public readonly kind: string;
  public readonly name: string;
  public readonly ending: string;
  public readonly text: string;
  public readonly label: string;

  public constructor(kind: string, name: string, ending: string, text: string, label: string) {
    this.kind = kind;
    this.name = name;
    this.ending = ending;
    this.text = text;
    this.label = label;
  }
}
