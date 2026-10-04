/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ContributionRow {
  public readonly name: string;
  public readonly title: string | null;

  public constructor(name: string, title: string | null) {
    this.name = name;
    this.title = title;
  }
}
