/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PlanTitleCase {
  public readonly text: string;
  public readonly first: string;

  public constructor(text: string, first: string) {
    this.text = text;
    this.first = first;
  }
}
