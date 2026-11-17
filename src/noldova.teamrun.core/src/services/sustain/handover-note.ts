/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class HandoverNote {
  public readonly prompt: string;
  public readonly carried: readonly string[];
  public readonly reads: string | null;

  public constructor(prompt: string, carried: readonly string[], reads: string | null) {
    this.prompt = prompt;
    this.carried = carried;
    this.reads = reads;
  }
}
