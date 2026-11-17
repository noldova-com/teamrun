/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ReplyWork, Resources } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { RecordingPartContext } from "../fixtures/recording-part-context.fixture.js";

@TestClass
export class ReplyWorkTests {
  @TestMethod
  public holdsOneWorkItemWhileAReplyRunsAndEndsItWhenNoneDoes(): void {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database);
    const engine = { activeRunCount: 1, waitForIdle: () => new Promise<void>(() => undefined) };
    const work = new ReplyWork(context, engine);

    work.onEvent();
    work.onEvent();
    const whileRunning = [...context.openWork];
    engine.activeRunCount = 0;
    work.onEvent();
    const afterwards = context.openWork.size;
    engine.activeRunCount = 1;
    work.onEvent();
    work[Symbol.dispose]();

    Assert.areEqual(Resources.replyWork, whileRunning.join(","));
    Assert.areEqual(2, context.beganWork);
    Assert.areEqual(0, afterwards);
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async endsTheWorkItemWhenTheLastReplyEndsWithNoFurtherEvent(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database);
    const idle = Promise.withResolvers<void>();
    const engine = { activeRunCount: 1, waitForIdle: () => idle.promise };
    const work = new ReplyWork(context, engine);

    work.onEvent();
    const whileRunning = context.openWork.size;
    const ended = context.whenWorkEnds();
    engine.activeRunCount = 0;
    idle.resolve();
    await ended;
    work[Symbol.dispose]();

    Assert.areEqual(1, whileRunning);
    Assert.areEqual(1, context.beganWork);
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async endsTheWorkItemWhenTheLastReplyFails(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database);
    const idle = Promise.withResolvers<void>();
    const engine = { activeRunCount: 1, waitForIdle: () => idle.promise };
    const work = new ReplyWork(context, engine);

    work.onEvent();
    const ended = context.whenWorkEnds();
    engine.activeRunCount = 0;
    idle.reject(new Error("The reply failed."));
    await ended;
    work[Symbol.dispose]();

    Assert.areEqual(1, context.beganWork);
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async keepsTheWorkItemWhileAReplyThatStartedMeanwhileRuns(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database);
    const waits = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
    const second = Promise.withResolvers<void>();
    let calls = 0;
    const engine = {
      activeRunCount: 1,
      waitForIdle: (): Promise<void> => {
        calls += 1;
        if (calls === 2)
          second.resolve();
        return waits[calls - 1]!.promise;
      }
    };
    const work = new ReplyWork(context, engine);

    work.onEvent();
    waits[0]!.resolve();
    await second.promise;
    const meanwhile = context.openWork.size;
    const ended = context.whenWorkEnds();
    engine.activeRunCount = 0;
    waits[1]!.resolve();
    await ended;
    work[Symbol.dispose]();

    Assert.areEqual(1, meanwhile);
    Assert.areEqual(2, calls);
    Assert.areEqual(1, context.beganWork);
    Assert.areEqual(0, context.openWork.size);
  }
}
