/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type BuildTarget from "./build-target.ts";

export default class UiShard {
  public readonly target: BuildTarget;
  public readonly index: number;
  public readonly count: number;

  public constructor(target: BuildTarget, index: number, count: number) {
    this.target = target;
    this.index = index;
    this.count = count;
  }
}
