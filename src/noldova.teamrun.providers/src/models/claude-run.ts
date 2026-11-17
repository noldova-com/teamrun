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

  public constructor(query: IClaudeQuery, abort: AbortController) {
    this.query = query;
    this.abort = abort;
  }

  public async stop(): Promise<void> {
    try {
      await this.query.interrupt();
    }
    catch { }
    this.abort.abort();
  }

  public close(): void {
    try {
      this.query.close();
    }
    catch { }
  }
}
