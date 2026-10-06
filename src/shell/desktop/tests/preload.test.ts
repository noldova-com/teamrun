/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { FakePreloadElectron } from "./fixtures/fake-preload-electron.fixture.js";

@TestClass
export class PreloadTests {
  @TestMethod
  public exposesExactlyItsMembersWithItsPlatformAndTheAppearanceItsWindowWasOpenedWith(): void {
    const api = FakePreloadElectron.load("{\"background\":\"#181818\"}").api("teamrun");

    Assert.areEqual([
      "platform", "processor", "appearance", "notifyReady", "notifyAppearance", "onCloseRequest", "answerClose", "onUpdateSaveRequest", "answerUpdateSave", "readStartup", "onStartup", "actOnStartup",
      "readLayout", "writeLayout", "request", "onEvent", "readBuild", "copyText", "openLogFolder", "openLink", "installCommand", "readUpdate", "onUpdate", "actOnUpdate", "keepAppearance",
      "readSpelling", "keepSpelling", "onFieldMenu", "replaceMisspelling", "addToDictionary", "edit", "setMenuBar", "onMenuCommand", "onNotificationOpened", "onQuitQuestion", "answerQuit", "logModule",
      "logError"
    ].join(","), Object.keys(api).join(","));
    Assert.areEqual(process.platform, api["platform"]);
    Assert.areEqual(process.arch, api["processor"]);
    Assert.areEqual("{\"background\":\"#181818\"}", JSON.stringify(api["appearance"]));
  }

  @TestMethod
  @TestData(null)
  @TestData("{not json")
  public startsWithoutAnAppearanceThatIsMissingOrNotJson(appearance: string | null): void {
    Assert.isNull(FakePreloadElectron.load(appearance).api("teamrun")["appearance"]);
  }

  @TestMethod
  public sendsEachNoticeOnItsOwnChannel(): void {
    const electron = FakePreloadElectron.load();
    const api = electron.api("teamrun");

    PreloadTests.invoke(api["notifyReady"], "ready");
    PreloadTests.invoke(api["notifyAppearance"], "appearance");
    PreloadTests.invoke(api["keepAppearance"], "preferences");
    PreloadTests.invoke(api["keepSpelling"], true, ["en-US"]);
    PreloadTests.invoke(api["setMenuBar"], "menus");
    PreloadTests.invoke(api["logModule"], "clock", "line");
    PreloadTests.invoke(api["logError"], null, "error");

    Assert.areEqual(JSON.stringify([
      ["teamrun:ready", "ready"],
      ["teamrun:appearance", "appearance"],
      ["teamrun:keepAppearance", "preferences"],
      ["teamrun:spelling", true, ["en-US"]],
      ["teamrun:menuBar", "menus"],
      ["teamrun:moduleLog", "clock", "line"],
      ["teamrun:windowError", null, "error"]
    ]), JSON.stringify(electron.sent));
  }

  @TestMethod
  public async asksEachQuestionOnItsOwnChannelAndAnswersWithTheReply(): Promise<void> {
    const electron = FakePreloadElectron.load();
    const api = electron.api("teamrun");

    const replies = await Promise.all([
      PreloadTests.invoke(api["answerClose"], "request", true),
      PreloadTests.invoke(api["answerUpdateSave"], "request", ["Notes couldn't save"]),
      PreloadTests.invoke(api["readStartup"]),
      PreloadTests.invoke(api["actOnStartup"], "retry"),
      PreloadTests.invoke(api["readLayout"]),
      PreloadTests.invoke(api["writeLayout"], "layout"),
      PreloadTests.invoke(api["request"], "notes.open", "payload"),
      PreloadTests.invoke(api["readBuild"]),
      PreloadTests.invoke(api["copyText"], "text"),
      PreloadTests.invoke(api["openLogFolder"]),
      PreloadTests.invoke(api["openLink"], "https://example.com/"),
      PreloadTests.invoke(api["installCommand"]),
      PreloadTests.invoke(api["readUpdate"]),
      PreloadTests.invoke(api["actOnUpdate"], "Check"),
      PreloadTests.invoke(api["readSpelling"]),
      PreloadTests.invoke(api["replaceMisspelling"], "world"),
      PreloadTests.invoke(api["addToDictionary"], "TeamRun"),
      PreloadTests.invoke(api["edit"], "Copy"),
      PreloadTests.invoke(api["answerQuit"], "wait")
    ]);

    Assert.areEqual(JSON.stringify([
      ["teamrun:closeAnswer", "request", true],
      ["teamrun:updateSaveAnswer", "request", ["Notes couldn't save"]],
      ["teamrun:readStartup"],
      ["teamrun:startupAction", "retry"],
      ["teamrun:readLayout"],
      ["teamrun:writeLayout", "layout"],
      ["teamrun:request", "notes.open", "payload"],
      ["teamrun:readBuild"],
      ["teamrun:copyText", "text"],
      ["teamrun:openLogFolder"],
      ["teamrun:openLink", "https://example.com/"],
      ["teamrun:installCommand"],
      ["teamrun:readUpdate"],
      ["teamrun:updateAction", "Check"],
      ["teamrun:readSpelling"],
      ["teamrun:replaceMisspelling", "world"],
      ["teamrun:addToDictionary", "TeamRun"],
      ["teamrun:edit", "Copy"],
      ["teamrun:quitAnswer", "wait"]
    ]), JSON.stringify(electron.invoked));
    Assert.areEqual(JSON.stringify(electron.invoked.map(t => t.length)), JSON.stringify(replies));
  }

  @TestMethod
  @TestData("onCloseRequest", "teamrun:closeRequest", 1)
  @TestData("onUpdateSaveRequest", "teamrun:updateSaveRequest", 1)
  @TestData("onStartup", "teamrun:startupState", 1)
  @TestData("onEvent", "teamrun:runtimeEvent", 2)
  @TestData("onMenuCommand", "teamrun:menuCommand", 1)
  @TestData("onFieldMenu", "teamrun:fieldMenu", 1)
  @TestData("onNotificationOpened", "teamrun:notificationOpened", 1)
  @TestData("onQuitQuestion", "teamrun:quitQuestion", 1)
  @TestData("onUpdate", "teamrun:updateState", 1)
  public passesEachEventToItsListenerUntilTheListenerIsRemoved(member: string, channel: string, valueCount: number): void {
    const electron = FakePreloadElectron.load();
    const heard: unknown[][] = [];
    const values = ["first", "second"].slice(0, valueCount);

    const remove = PreloadTests.invoke(electron.api("teamrun")[member], (...received: unknown[]) => heard.push(received));
    electron.emit(channel, ...values);
    PreloadTests.invoke(remove);
    electron.emit(channel, ...values);

    Assert.areEqual(JSON.stringify([values]), JSON.stringify(heard));
    Assert.areEqual(0, electron.count(channel));
  }

  private static invoke(method: unknown, ...values: unknown[]): unknown {
    Assert.isTrue(typeof method === "function", String(method));
    return (method as (...values: unknown[]) => unknown)(...values);
  }
}
