/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ScriptAnswer {
  public readonly status: number | null;
  public readonly lines: readonly string[];

  public constructor(status: number | null, lines: readonly string[]) {
    this.status = status;
    this.lines = lines;
  }
}
