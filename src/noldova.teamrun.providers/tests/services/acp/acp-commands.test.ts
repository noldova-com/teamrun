/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpCommands } from "@noldova/teamrun.providers";

import { HeldDelayTimer } from "../../fixtures/held-delay-timer.fixture.js";

@TestClass
export class AcpCommandsTests {
  @TestMethod
  public keepsEachSessionsLatestListByNameAndWaitsForTheFirstUntilItComes(): Promise<void> {
    return AcpCommandsTests.check(async (commands, update, timer) => {
      const waited = commands.listOf("s1", timer, 1000, new AbortController().signal);
      commands.note("session/update", JsonReader.fromValue({ sessionId: "s1" }));
      commands.note("session/request_permission", JsonReader.fromValue({ sessionId: "s1", update: AcpCommandsTests.listing("other") }));
      update("s1", { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } });
      update("s2", AcpCommandsTests.listing("other"));
      update("s1", { sessionUpdate: "available_commands_update", availableCommands: [{ name: "review", description: "Reviews" },
        { name: "/init", description: "Starts", input: { hint: "folder" } }] });

      Assert.areEqual(JSON.stringify(["review", "init"]), JSON.stringify(await waited));
      update("s1", AcpCommandsTests.listing());
      Assert.areEqual("[]", JSON.stringify(await commands.listOf("s1", timer, 1000, new AbortController().signal)));
      Assert.areEqual(JSON.stringify(["other"]), JSON.stringify(await commands.listOf("s2", timer, 1000, new AbortController().signal)));
      Assert.areEqual(JSON.stringify([1000]), JSON.stringify(timer.requested));
    });
  }

  @TestMethod
  public answersNoListWhenNoneCameInTimeOrTheTurnStoppedAndKeepsOneThatComesLater(): Promise<void> {
    return AcpCommandsTests.check(async (commands, update, timer) => {
      const stopped = new AbortController();
      const held = commands.listOf("s1", timer, 1000, stopped.signal);
      stopped.abort();

      Assert.isNull(await held);
      Assert.isNull(await commands.listOf("s2", timer, 1, new AbortController().signal));
      update("s1", AcpCommandsTests.listing("review"));
      Assert.areEqual(JSON.stringify(["review"]), JSON.stringify(await commands.listOf("s1", timer, 1000, new AbortController().signal)));
    });
  }

  @TestMethod
  public readsACommandsNameFromAfterItsSlashUpToTheFirstSpace(): void {
    Assert.areEqual("review,/review,init,/init", [AcpCommands.nameOf("/review src now"), AcpCommands.shownOf("/review src now"), AcpCommands.nameOf("/init\nnext"),
      AcpCommands.shownOf("/init")].join(","));
  }

  private static listing(...names: string[]): JsonObject {
    return { sessionUpdate: "available_commands_update", availableCommands: names.map(t => ({ name: t, description: t })) };
  }

  private static async check(test: (commands: AcpCommands, update: (sessionId: string, update: JsonObject) => void, timer: HeldDelayTimer) => Promise<void>): Promise<void> {
    const commands = new AcpCommands();
    await test(commands, (sessionId, update) => commands.note("session/update", JsonReader.fromValue({ sessionId, update })), new HeldDelayTimer(1000));
  }
}
