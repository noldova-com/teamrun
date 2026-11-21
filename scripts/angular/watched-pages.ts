/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserSessionRecord } from "./browser-session-record.ts";
import type { IWatchedPage } from "./interfaces/i-watched-page.ts";

export class WatchedPages extends Map<string, IWatchedPage> {
  private readonly expected: Map<string, BrowserSessionRecord> = new Map();

  public constructor(pages: ReadonlyMap<string, IWatchedPage>) {
    super();
    for (const [sessionId, page] of pages)
      this.set(sessionId, page);
  }

  public expect(sessionId: string, record: BrowserSessionRecord): void {
    this.expected.set(sessionId, record);
  }

  public override set(sessionId: string, page: IWatchedPage): this {
    this.expected.get(sessionId)?.watch(page);
    this.expected.delete(sessionId);
    return super.set(sessionId, page);
  }
}
