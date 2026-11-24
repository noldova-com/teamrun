/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SamplePageSection {
  public readonly title: string;
  public readonly depth: number;

  public constructor(title: string, depth: number) {
    this.title = title;
    this.depth = depth;
  }
}
