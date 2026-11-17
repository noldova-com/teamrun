/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BackgroundTask, BackgroundTaskPage, BackgroundTaskStatus } from "@noldova/teamrun.protocol";

@TestClass
export class BackgroundTaskPageTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const task = new BackgroundTask("task-1", "conv-1", "msg-1", "codex", "npm test", BackgroundTaskStatus.Completed, 0, "2026-10-21T10:00:00.000Z",
      "2026-10-21T10:01:00.000Z", null);
    const page = new BackgroundTaskPage([task], true, 40);

    const read = BackgroundTaskPage.fromJson(JSON.parse(JSON.stringify(page.toJson())));

    Assert.areEqual(JSON.stringify(page.toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual("task-1:true:40", [read.tasks.map(t => t.id).join(","), read.hasLater, read.count].join(":"));
    Assert.areEqual(0, new BackgroundTaskPage([], false, 0).tasks.length);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const tasks = Assert.throws(() => BackgroundTaskPage.fromJson({ tasks: "x", hasLater: false, count: 0 }), JsonException);
    const task = Assert.throws(() => BackgroundTaskPage.fromJson({ tasks: [{ id: "task-1" }], hasLater: false, count: 0 }), JsonException);
    const flag = Assert.throws(() => BackgroundTaskPage.fromJson({ tasks: [], hasLater: "no", count: 0 }), JsonException);
    const count = Assert.throws(() => BackgroundTaskPage.fromJson({ tasks: [], hasLater: false, count: "1" }), JsonException);

    Assert.areEqual("$.tasks:$.hasLater:$.count", [tasks.path, flag.path, count.path].join(":"));
    Assert.isTrue(String(task.path).startsWith("$.tasks") && String(task.path).endsWith("chatId"), String(task.path));
  }

  @TestMethod
  public rejectsACountThatIsNegativeOrNotAnInteger(): void {
    Assert.throws(() => new BackgroundTaskPage([], false, -1), ArgumentOutOfRangeException);
    Assert.throws(() => new BackgroundTaskPage([], false, 1.5), ArgumentOutOfRangeException);
  }
}
