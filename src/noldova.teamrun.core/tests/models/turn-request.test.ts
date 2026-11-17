/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, TurnRequest, TurnTools } from "@noldova/teamrun.core";
import { MessageAttachment, RequestedSettings, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";

@TestClass
export class TurnRequestTests {
  private static readonly requested: RequestedSettings = new RequestedSettings("fake", "fake-large", "high");

  @TestMethod
  public holdsWhatAnAdapterNeeds(): void {
    const request = new TurnRequest(null, "D:/work", "Hello", TurnRequestTests.requested, "session-1");

    Assert.isNull(request.provider);
    Assert.areEqual("D:/work", request.workingDirectory);
    Assert.areEqual("Hello", request.prompt);
    Assert.areEqual("fake-large", request.requested.model);
    Assert.areEqual("session-1", request.resumeNativeSessionId);
    Assert.isNull(new TurnRequest(null, "D:/work", "Hello", TurnRequestTests.requested, null).resumeNativeSessionId);
    Assert.isNull(request.resumeAt);
    Assert.isNull(request.command);
  }

  @TestMethod
  public rejectsBlankTexts(): void {
    Assert.areEqual("workingDirectory", Assert.throws(() => new TurnRequest(null, " ", "Hello", TurnRequestTests.requested, null), ArgumentException).parameterName);
    Assert.areEqual("prompt", Assert.throws(() => new TurnRequest(null, "D:/work", "", TurnRequestTests.requested, null), ArgumentException).parameterName);
    Assert.areEqual("resumeNativeSessionId", Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, " "), ArgumentException).parameterName);
    Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, null, [], " "), ArgumentException);
    Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, null, [], null, " "), ArgumentException);
    Assert.areEqual("resumeAt", Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, "session-1", [], null, null, {}, false, null, [],
      " "), ArgumentException).parameterName);
    Assert.areEqual("command", Assert.throws(() => new TurnRequest(null, "D:/work", "Hi", TurnRequestTests.requested, null, [], null, null, {}, false, null, [], null,
      () => false, undefined, null, false, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public leavesOutItsImagesWithALineNamingThemInEachPrompt(): void {
    const notes = new MessageAttachment("notes.txt", "text/plain", 4, "D:/data/notes.txt");
    const images = [new MessageAttachment("chart.png", "image/png", 4, "D:/data/chart.png"), new MessageAttachment("b.jpg", "image/jpeg", 4, "D:/data/b.jpg")];
    const shared = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null);
    const request = new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, "session-1", [images[0]!, notes, images[1]!], "Role", "Context and look",
      { TEAMRUN_SENDER_TOKEN: "c1" }, false, null, [shared], "turn-3", () => false, undefined, "Role without tools", false, "/review src", true);

    const sent = request.withoutImages();

    Assert.areEqual(notes.path, sent.attachments.map(t => t.path).join(","));
    Assert.areEqual(Resources.formatImagesLeftOut("Look", ['"chart.png"', '"b.jpg"']), sent.prompt);
    Assert.areEqual(Resources.formatImagesLeftOut("Context and look", ['"chart.png"', '"b.jpg"']), sent.freshPrompt);
    Assert.areEqual("session-1,turn-3,Role,fake-large,Role without tools,/review src,true", [sent.resumeNativeSessionId, sent.resumeAt, sent.instructions,
      sent.requested.model, sent.instructionsWithoutTools, sent.command, sent.compactsWhenIdle].join(","));
    Assert.areEqual(JSON.stringify({ TEAMRUN_SENDER_TOKEN: "c1" }), JSON.stringify(sent.environment));
    Assert.areEqual(JSON.stringify([shared.toJson()]), JSON.stringify(sent.sharedServers.map(t => t.toJson())));
    Assert.areEqual(0, new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, null).sharedServers.length);
    Assert.areEqual(0, Object.keys(new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, null).environment).length);
    Assert.isNull(new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, null, images).withoutImages().freshPrompt);
    const files = new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, null, [notes]);
    Assert.areEqual(files, files.withoutImages());
  }

  @TestMethod
  public asksForOtherSettingsKeepingAllElse(): void {
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, []);
    const shared = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null);
    const request = new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, "session-1", [], "Role", "Context", { TEAMRUN_SENDER_TOKEN: "c1" }, true, tools,
      [shared], "turn-3", () => false, undefined, "Role without tools", false, "/compact", true);

    const sent = request.withRequested(new RequestedSettings("fake", "fake-small", "low", "fast"));

    Assert.areEqual("fake-small,low,fast", [sent.requested.model, sent.requested.effort, sent.requested.speed].join(","));
    Assert.areEqual("D:/work,Look,session-1,turn-3,Role,Context,c1,true,Role without tools,/compact", [sent.workingDirectory, sent.prompt, sent.resumeNativeSessionId,
      sent.resumeAt, sent.instructions, sent.freshPrompt, sent.environment["TEAMRUN_SENDER_TOKEN"], sent.compacts, sent.instructionsWithoutTools, sent.command].join(","));
    Assert.areEqual(tools, sent.tools);
    Assert.isTrue(sent.compactsWhenIdle);
    Assert.isFalse(new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, null).compactsWhenIdle);
    Assert.areEqual(JSON.stringify([shared.toJson()]), JSON.stringify(sent.sharedServers.map(t => t.toJson())));
  }

  @TestMethod
  public routesAnAdoptedSenderTokenThroughItsCallbackAndItsCopiesAndRefusesEveryTokenWithoutOne(): void {
    const adopted: string[] = [];
    const image = new MessageAttachment("chart.png", "image/png", 4, "D:/data/chart.png");
    const request = new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, "session-1", [image], null, null, {}, false, null, [], null,
      t => adopted.push(t) > 0);

    const routed = [request.adoptSender("t1"), request.withRequested(TurnRequestTests.requested).adoptSender("t2"), request.withoutImages().adoptSender("t3")];

    Assert.areEqual(JSON.stringify([true, true, true]), JSON.stringify(routed));
    Assert.areEqual("t1,t2,t3", adopted.join(","));
    Assert.isFalse(new TurnRequest(null, "D:/work", "Look", TurnRequestTests.requested, null).adoptSender("t1"));
  }
}
