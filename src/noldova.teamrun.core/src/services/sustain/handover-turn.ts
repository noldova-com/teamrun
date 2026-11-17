/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class HandoverTurn {
  public readonly sequence: number;
  public readonly text: string;
  public readonly cut: boolean;
  public readonly tools: boolean;

  public constructor(sequence: number, text: string, cut: boolean = false, tools: boolean = false) {
    this.sequence = sequence;
    this.text = text;
    this.cut = cut;
    this.tools = tools;
  }
}
