/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Bounds } from "./bounds";
import { SplitPart } from "./split-part";
import { SplitNode } from "./split.node";

export class SplitHandle {
  private readonly leadingMinimum: number;
  private readonly sharedLength: number;
  public readonly split: SplitNode;
  public readonly index: number;
  public readonly bounds: Bounds;
  public readonly leadingLength: number;

  public constructor(split: SplitNode, index: number, bounds: Bounds, leadingLength: number, leadingMinimum: number, sharedLength: number) {
    this.leadingMinimum = leadingMinimum;
    this.sharedLength = sharedLength;
    this.split = split;
    this.index = index;
    this.bounds = bounds;
    this.leadingLength = leadingLength;
  }

  public get minimumLength(): number {
    return this.leadingMinimum;
  }

  public get maximumLength(): number {
    return this.leadingMinimum + this.pairWeight * Math.max(0, this.sharedLength);
  }

  private get pairWeight(): number {
    return this.split.parts.reduce((sum, t, index) => index === this.index || index === this.index + 1 ? sum + t.weight : sum, 0);
  }

  public resize(leadingLength: number): SplitNode {
    if (this.sharedLength <= 0)
      return this.split;
    const pair = this.pairWeight;
    const share = Math.min(pair, Math.max(0, (leadingLength - this.leadingMinimum) / this.sharedLength));
    const parts = this.split.parts.map((t, index) => new SplitPart(t.node, index === this.index ? share : index === this.index + 1 ? pair - share : t.weight));
    return new SplitNode(this.split.id, this.split.axis, parts);
  }
}
