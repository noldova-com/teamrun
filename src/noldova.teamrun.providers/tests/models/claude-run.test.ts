/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClaudeRun } from "@noldova/teamrun.providers";

import { FakeClaudeQuery } from "../fixtures/fake-claude-query.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class ClaudeRunTests {
  @TestMethod
  public async stopsByInterruptingThenAborting(): Promise<void> {
    const query = new FakeClaudeQuery([]);
    const abort = new AbortController();
    const run = new ClaudeRun(query, abort, 1000);

    await run.stop();
    run.close();

    Assert.areEqual(1, query.interruptCount);
    Assert.isTrue(abort.signal.aborted);
    Assert.areEqual(1, query.closeCount);
  }

  @TestMethod
  public async abortsAndClosesOnceTheWaitPassesWhenTheQueryNeverAnswersItsInterrupt(): Promise<void> {
    const query = new FakeClaudeQuery([]);
    query.interruptHang = true;
    const abort = new AbortController();
    const run = new ClaudeRun(query, abort, 10);

    const stopping = run.stop();
    await Wait.until(() => abort.signal.aborted, "The stop did not abort once its wait passed.");
    await stopping;
    run.close();

    Assert.areEqual(JSON.stringify([1, 1]), JSON.stringify([query.interruptCount, query.closeCount]));
  }

  @TestMethod
  public async toleratesAQueryThatRefusesToInterruptOrClose(): Promise<void> {
    const query = new FakeClaudeQuery([]);
    query.interruptFailure = new Error("gone");
    query.closeFailure = new Error("closed");
    const abort = new AbortController();
    const run = new ClaudeRun(query, abort, 1000);

    await run.stop();
    run.close();

    Assert.isTrue(abort.signal.aborted);
    Assert.areEqual(1, query.closeCount);
  }
}
