/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StressChatResources } from "@noldova/teamrun.runtime/development";

@TestClass
export class StressChatResourcesTests {
  @TestMethod
  public formatsTheTokensAndTheTitleForTheFullChat(): void {
    Assert.areEqual("TURN-00001", StressChatResources.formatToken(1));
    Assert.areEqual("TURN-05000", StressChatResources.formatToken(5000));
    Assert.areEqual("10,000 messages", StressChatResources.formatTitle(5000));
    Assert.areEqual("2 messages", StressChatResources.formatTitle(1));
  }

  @TestMethod
  public introducesTheChatAsSyntheticWithNoSessionProviderOrLiveTeammates(): void {
    const introduction = StressChatResources.formatIntroduction(5000, 25);

    Assert.isTrue(introduction.startsWith("**TURN-00001** · Short reply\n\n## 10,000 messages\n\nThis chat holds **5,000 pairs** of a person's message and a reply, "
      + "from 25 repeating scenarios, which `npm run seed:stress` wrote. Everything in it is synthetic."));
    Assert.isTrue(introduction.includes("Search for **TURN-02500** to jump to the middle, or **TURN-00001** for the start."));
    Assert.isTrue(introduction.endsWith("Every reply has finished. No provider or provider session is attached to this chat or its replies, "
      + "and the names it mentions, @Atlas and @Nova, are not live teammates."));
    Assert.isTrue(StressChatResources.formatIntroduction(1, 25).includes("**TURN-00001** to jump to the middle"));
  }

  @TestMethod
  public formatsTheRequestsAndTheReplysContent(): void {
    Assert.areEqual("**TURN-00007** · C#\n\nShow the c# example. This is synthetic test data.", StressChatResources.formatRequest(7, "C#"));
    Assert.areEqual("**TURN-00023** · Mentions\n\n@Atlas and @Nova, look at this request together. This is synthetic test data.",
      StressChatResources.formatMentionRequest(23, "Mentions"));
    Assert.areEqual("**Tables**", StressChatResources.formatHeading("Tables"));
    Assert.isTrue(StressChatResources.formatParagraph(4, 2).startsWith("Paragraph 2 of turn 4. "));
    Assert.areEqual(3, StressChatResources.formatProse(4, 3).split("\n\n").length);
    Assert.areEqual("+// long diff content long diff content", StressChatResources.formatLongDiff().split("\n").at(-1)?.slice(0, 39));
    Assert.areEqual(2019, StressChatResources.formatLongLines(1).split("\n")[2]?.length);
    Assert.areEqual("Read file.ts", StressChatResources.formatReadStep("file.ts"));
    Assert.areEqual("Grep: a synthetic step\nExample result one\nExample result two", StressChatResources.formatToolStep("Grep"));
    Assert.areEqual("Write file.ts", StressChatResources.formatEditStep("Write", "file.ts"));
    Assert.areEqual("websearch-12", StressChatResources.formatToolUseId("WebSearch", 12));
    Assert.areEqual(join("root", "src", "example.ts"), StressChatResources.formatSourcePath("root", "example.ts"));
    Assert.areEqual(join("root", "images", "4k.png"), StressChatResources.formatImagePath("root", "4k.png"));
  }

  @TestMethod
  public formatsTheCommandsMessages(): void {
    Assert.areEqual("DATA_DIR names \"data\", which is not an absolute folder; name the development data folder by its absolute path.",
      StressChatResources.formatRelativeFolder("DATA_DIR", "data"));
    Assert.areEqual("/home/.app is the installed TeamRun's data folder; the stress chat goes only into a development data folder, "
      + "app/_build/data or another one DATA_DIR names.", StressChatResources.formatInstalledFolder("/home/.app", "DATA_DIR"));
    Assert.areEqual("TeamRun is running on /data; quit it and run the command again.", StressChatResources.formatOwned("/data"));
    Assert.areEqual("Wrote the chat \"10,000 messages\" into the project /data/stress-chat in 12,345 ms.\n",
      StressChatResources.formatSeeded(5000, "/data/stress-chat", 12345));
  }
}
