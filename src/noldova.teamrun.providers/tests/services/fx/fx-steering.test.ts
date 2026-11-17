/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { TurnOutcome, TurnSteer } from "@noldova/teamrun.core";
import { MessageAttachment } from "@noldova/teamrun.protocol";
import { FxSteering } from "@noldova/teamrun.providers";
import { FxTestHost } from "../../fixtures/fx-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class FxSteeringTests {
  @TestMethod
  public async joinsATextSteerToTheRunningTurnAndLeavesOneWithAnImageForItsOwnTurn(): Promise<void> {
    await using host = new FxTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);
    const image = new MessageAttachment("image.png", "image/png", 3, host.directory.resolve("image.png"));
    const notes = new MessageAttachment("notes.txt", "text/plain", 1, host.directory.resolve("notes.txt"));
    writeFileSync(image.path, "png");
    try {
      const running = adapter.runTurn(host.request("cancel"), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.includes("working"), "The listener did not see 'working'.");
      await Wait.until(() => offers.length === 1, "The listener did not get a steering offer.");
      const offered = offers[0];
      const withImage = await offered?.(new TurnSteer("See this", [image]));
      const taking = offered?.(new TurnSteer("Look again", [notes]));
      await Wait.until(() => offers.length === 2, "The second steering offer did not come.");
      writeFileSync(host.directory.resolve("chat", "steer-released.txt"), "");
      const taken = await taking;
      const result = await running;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("false|true", [withImage, taken].join("|"));
      Assert.areEqual("function|null", offers.map(t => Object.isNull(t) ? "null" : typeof t).join("|"));
      Assert.isTrue(listener.texts.join("").endsWith(JSON.stringify([{ type: "text", text: "Look again" }])), listener.texts.join("|"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  @TestData({}, false)
  @TestData({ _meta: null }, false)
  @TestData({ _meta: {} }, false)
  @TestData({ _meta: { fx: null } }, false)
  @TestData({ _meta: { fx: { steering: "dropped" } } }, false)
  @TestData({ _meta: { fx: { steering: "absorbed" } } }, true)
  public takesOnlyASteerFxSaysItAbsorbed(result: object, took: boolean): void {
    Assert.areEqual(took, new FxSteering().took(JsonReader.fromValue(result)));
  }
}
