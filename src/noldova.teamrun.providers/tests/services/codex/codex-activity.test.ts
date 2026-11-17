/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { CodexActivity, Deadline } from "@noldova/teamrun.providers";

@TestClass
export class CodexActivityTests {
  @TestMethod
  public async extendsTheSilenceOnlyForTheHeldThreadAndTheSubAgentThreadsItFollows(): Promise<void> {
    const timer = new ManualTimer();
    const silence = new Deadline(timer, 100, () => undefined);
    const asked: unknown[] = [];
    const activity = new CodexActivity("thread-1", t => {
      asked.push(t);
      return t === "child-1";
    }, silence);
    silence.start();
    const begun = async (params: object): Promise<number> => {
      await activity.handleNotificationAsync("item/completed", JsonReader.parse(JSON.stringify(params)));
      return timer.begun;
    };

    const counts = [await begun({ threadId: "thread-1" }), await begun({ threadId: "child-1" }), await begun({ threadId: "thread-2" }), await begun({})];

    Assert.areEqual(JSON.stringify([2, 3, 3, 3]), JSON.stringify(counts));
    Assert.areEqual(JSON.stringify(["child-1", "thread-2", null]), JSON.stringify(asked));
    Assert.areEqual(1, timer.pending);
  }
}
