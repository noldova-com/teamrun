/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ClaudeRun } from "@noldova/teamrun-providers";

import { FakeClaudeQuery } from "../fixtures/fake-claude-query.fixture.js";

@TestClass
export class ClaudeRunTests {
  @TestMethod
  public async stopsByInterruptingThenAborting(): Promise<void> {
    const query = new FakeClaudeQuery([]);
    const abort = new AbortController();
    const run = new ClaudeRun(query, abort);

    await run.stop();
    run.close();

    Assert.areEqual(1, query.interruptCount);
    Assert.isTrue(abort.signal.aborted);
    Assert.areEqual(1, query.closeCount);
  }

  @TestMethod
  public async toleratesAQueryThatRefusesToInterruptOrClose(): Promise<void> {
    const query = new FakeClaudeQuery([]);
    query.interruptFailure = new Error("gone");
    query.closeFailure = new Error("closed");
    const abort = new AbortController();
    const run = new ClaudeRun(query, abort);

    await run.stop();
    run.close();

    Assert.isTrue(abort.signal.aborted);
    Assert.areEqual(1, query.closeCount);
  }
}
