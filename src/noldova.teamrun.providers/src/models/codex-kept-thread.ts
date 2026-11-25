/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICodexHold } from "../interfaces/i-codex-hold.js";

export class CodexKeptThread {
  public readonly threadId: string;
  public readonly held: ICodexHold;
  public readonly resolve: () => void;

  public constructor(threadId: string, held: ICodexHold, resolve: () => void) {
    this.threadId = threadId;
    this.held = held;
    this.resolve = resolve;
  }
}
