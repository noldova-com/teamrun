/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProjectIdParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";

@TestClass
export class ForgetProjectCommandTests {
  @TestMethod
  public async forgetsAProjectAndSaysItsChatsAreDeleted(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.projectForget", () => null);

    const result = await context.runAsync("teamrun.forgetProject", { projectId: "p1" });

    Assert.areEqual("Forgot project p1 and deleted its chats.", result.text);
    Assert.isNull(result.value);
    Assert.areEqual("p1", ProjectIdParams.fromJson(context.payloadsOf("teamrun.projectForget")[0]).projectId);
  }
}
