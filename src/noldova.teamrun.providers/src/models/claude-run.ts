/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IClaudeQuery } from "../interfaces/i-claude-query.js";

export class ClaudeRun {
  private readonly query: IClaudeQuery;
  private readonly abort: AbortController;
  private readonly wait: number;
  private closed: boolean = false;

  public constructor(query: IClaudeQuery, abort: AbortController, wait: number) {
    this.query = query;
    this.abort = abort;
    this.wait = wait;
  }

  public async stop(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([this.query.interrupt(), new Promise<void>(resolve => timer = setTimeout(resolve, this.wait))]);
    }
    catch { }
    clearTimeout(timer);
    this.abort.abort();
    this.close();
  }

  public close(): void {
    if (this.closed)
      return;
    this.closed = true;
    try {
      this.query.close();
    }
    catch { }
  }
}
