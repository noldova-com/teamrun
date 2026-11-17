/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TaskEnd, TaskStart } from "@noldova/teamrun.core";
import { BackgroundTaskStatus } from "@noldova/teamrun.protocol";

@TestClass
export class TaskStartTests {
  @TestMethod
  public async holdsTheTaskAndHowToStopIt(): Promise<void> {
    let stops = 0;
    const start = new TaskStart("item-1", "npm run dev", () => {
      stops += 1;
      return Promise.resolve();
    });

    await start.stop();

    Assert.areEqual("item-1", start.taskId);
    Assert.areEqual("npm run dev", start.command);
    Assert.areEqual(1, stops);
    Assert.isTrue(start.hasOwnStop);
    Assert.isFalse(new TaskStart("item-2", "Explore", () => Promise.resolve(), "item-2", false).hasOwnStop);
  }

  @TestMethod
  public rejectsABlankIdOrCommand(): void {
    Assert.areEqual("taskId", Assert.throws(() => new TaskStart(" ", "npm run dev", () => Promise.resolve()), ArgumentException).parameterName);
    Assert.areEqual("command", Assert.throws(() => new TaskStart("item-1", String.empty, () => Promise.resolve()), ArgumentException).parameterName);
  }

  @TestMethod
  public endsWithAStatusOtherThanRunning(): void {
    const end = new TaskEnd("item-1", BackgroundTaskStatus.Failed, 2);

    Assert.areEqual("item-1", end.taskId);
    Assert.areEqual(BackgroundTaskStatus.Failed, end.status);
    Assert.areEqual(2, end.exitCode);
    Assert.isNull(new TaskEnd("item-1", BackgroundTaskStatus.Ended).exitCode);
    Assert.areEqual("status", Assert.throws(() => new TaskEnd("item-1", BackgroundTaskStatus.Running), ArgumentException).parameterName);
    Assert.areEqual("taskId", Assert.throws(() => new TaskEnd(String.empty, BackgroundTaskStatus.Stopped), ArgumentException).parameterName);
  }
}
