/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class HandoverPrompt {
  public readonly text: string;
  public readonly carried: readonly string[];
  public readonly leftOut: boolean;

  public constructor(text: string, carried: readonly string[], leftOut: boolean) {
    this.text = text;
    this.carried = carried;
    this.leftOut = leftOut;
  }
}
