/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StoppedCommands } from "@noldova/teamrun.core";

@TestClass
export class StoppedCommandsTests {
  @TestMethod
  public keepsEachChatsAndTeammatesLinesInOrderApart(): void {
    const stopped = new StoppedCommands();
    stopped.add("c1", "ada", "- one");
    stopped.add("c1", null, "- two");
    stopped.add("c2", "ada", "- three");
    stopped.add("c1", "ada", "- four");

    Assert.areEqual("- one,- four", stopped.of("c1", "ada").join());
    Assert.areEqual("- two", stopped.of("c1", null).join());
    Assert.areEqual("- three", stopped.of("c2", "ada").join());
    Assert.areEqual(0, stopped.of("c2", null).length);
    Assert.areEqual(0, stopped.of("c3", "ada").length);
  }

  @TestMethod
  public dropsOnlyTheToldLinesKeepingThoseAddedWhileTheTurnRan(): void {
    const stopped = new StoppedCommands();
    stopped.add("c1", "ada", "- one");
    const told = stopped.of("c1", "ada");
    stopped.add("c1", "ada", "- two");

    stopped.told("c1", "ada", told);
    Assert.areEqual("- two", stopped.of("c1", "ada").join());
    stopped.told("c1", "ada", stopped.of("c1", "ada"));
    Assert.areEqual(0, stopped.of("c1", "ada").length);
    stopped.told("c2", null, ["- none"]);
    Assert.areEqual(0, stopped.of("c2", null).length);
  }

  @TestMethod
  public forgetsADeletedChatsLinesAndALeavingTeammatesInOneChatOrEvery(): void {
    const stopped = new StoppedCommands();
    for (const chat of ["c1", "c2", "c3"]) {
      stopped.add(chat, "ada", `- ${chat} ada`);
      stopped.add(chat, "bob", `- ${chat} bob`);
      stopped.add(chat, null, `- ${chat} own`);
    }

    stopped.forget(["c1"]);
    stopped.forgetTeammate("ada", "c2");
    stopped.forgetTeammate("bob", null);
    const all = ["c1", "c2", "c3"].flatMap(chat => ["ada", "bob", null].flatMap(teammate => stopped.of(chat, teammate)));
    Assert.areEqual("- c2 own,- c3 ada,- c3 own", all.join());
  }
}
