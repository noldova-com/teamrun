/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AcpActivity, Deadline, type IAcpClientListener } from "@noldova/teamrun.providers";

@TestClass
export class AcpActivityTests {
  @TestMethod
  public async extendsTheSilenceForEachNotificationAndRequestAndPassesEveryMessageOn(): Promise<void> {
    const timer = new ManualTimer();
    const silence = new Deadline(timer, 100, () => undefined);
    const passed: string[] = [];
    const listener: IAcpClientListener = {
      onNotificationAsync: method => {
        passed.push(`notification ${method}`);
        return Promise.resolve();
      },
      onRequest: (id, method) => {
        passed.push(`request ${id} ${method}`);
        return Promise.resolve<JsonValue>("answer");
      },
      onResponseAsync: (method, result) => {
        passed.push(`response ${method} ${String(Object.isNull(result))}`);
        return Promise.resolve();
      },
      onExitAsync: () => {
        passed.push("exit");
        return Promise.resolve();
      }
    };
    const activity = new AcpActivity(listener, silence);
    silence.start();
    const params = JsonReader.fromValue({});

    await activity.onNotificationAsync("session/update", params);
    const notified = timer.begun;
    const answer = await activity.onRequest("7", "fs/read_text_file", params);
    const requested = timer.begun;
    await activity.onResponseAsync("session/prompt", null);
    await activity.onExitAsync();

    Assert.areEqual(JSON.stringify([2, 3, 3, "answer"]), JSON.stringify([notified, requested, timer.begun, answer]));
    Assert.areEqual(JSON.stringify(["notification session/update", "request 7 fs/read_text_file", "response session/prompt true", "exit"]), JSON.stringify(passed));
    Assert.areEqual(1, timer.pending);
  }
}
