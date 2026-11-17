/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import { WorkingMethod } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { RecordingPartContext } from "../fixtures/recording-part-context.fixture.js";

@TestClass
export class WorkingMethodTests {
  @TestMethod
  public async holdsAWorkItemWhileEachRequestRunsAndEndsItWhetherTheRequestSucceedsOrFails(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("module", database);
    const answers: PromiseWithResolvers<JsonValue>[] = [];
    const method = new WorkingMethod({ handleAsync: () => WorkingMethodTests.pending(answers) }, context, "A chat is rewinding.");

    const succeeding = method.handleAsync(WorkingMethodTests.request());
    const failing = method.handleAsync(WorkingMethodTests.request());
    const during = [...context.openWork];
    answers[0]!.resolve({ done: true });
    const answered = await succeeding;
    answers[1]!.reject(new Error("The rewind failed."));
    const failure = await failing.then(() => null, (t: unknown) => t);

    Assert.areEqual("A chat is rewinding.", during.join(","));
    Assert.areEqual(2, context.beganWork);
    Assert.areEqual(JSON.stringify({ done: true }), JSON.stringify(answered));
    Assert.areEqual("The rewind failed.", (failure as Error).message);
    Assert.areEqual(0, context.openWork.size);
  }

  @TestMethod
  public async waitsUntilEveryRequestRunningNowHasEndedHoweverItEnds(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("module", database);
    const answers: PromiseWithResolvers<JsonValue>[] = [];
    const method = new WorkingMethod({ handleAsync: () => WorkingMethodTests.pending(answers) }, context, "A chat is rewinding.");
    await method.whenIdle();
    let idle = false;

    const first = method.handleAsync(WorkingMethodTests.request());
    const second = method.handleAsync(WorkingMethodTests.request()).catch(() => null);
    const waiting = method.whenIdle().then(() => {
      idle = true;
    });
    answers[1]!.reject(new Error("The rewind failed."));
    await second;
    const idleWithOneRunning = idle;
    answers[0]!.resolve(null);
    await first;
    await waiting;

    Assert.isFalse(idleWithOneRunning);
    Assert.isTrue(idle);
  }

  private static pending(answers: PromiseWithResolvers<JsonValue>[]): Promise<JsonValue> {
    const answer = Promise.withResolvers<JsonValue>();
    answers.push(answer);
    return answer.promise;
  }

  private static request(): RequestContext {
    return new RequestContext("tests", null, new AbortController().signal, 1);
  }
}
