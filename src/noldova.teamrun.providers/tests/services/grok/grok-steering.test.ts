/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnOutcome, TurnSteer } from "@noldova/teamrun.core";
import { MessageAttachment } from "@noldova/teamrun.protocol";
import { GrokSteering, Resources } from "@noldova/teamrun.providers";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class GrokSteeringTests {
  @TestMethod
  public async interjectsIntoTheRunningTurnWithItsImagesAndRefusesOnceTheTurnEnded(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);
    const image = host.directory.resolve("image.png");
    writeFileSync(image, "png");
    try {
      const running = adapter.runTurn(host.request("cancel"), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.includes("working"), "The listener did not see 'working'.");
      await Wait.until(() => offers.length === 1, "The listener did not get a steering offer.");
      const offered = offers[0];
      const taken = await offered?.(new TurnSteer("Look again", [new MessageAttachment("image.png", "image/png", 3, image)]));
      const result = await running;
      const late = await offered?.(new TurnSteer("Too late", []));

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("true|false", [taken, late].join("|"));
      Assert.areEqual("function|null", offers.map(t => Object.isNull(t) ? "null" : typeof t).join("|"));
      Assert.isTrue(listener.texts.join("").endsWith(JSON.stringify({ text: "Look again", content: [{ type: "text", text: "Look again" },
        { type: "image", mimeType: "image/png", data: Buffer.from("png").toString("base64") }] })), listener.texts.join("|"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public interjectsWithTheMessagesTextAndBlocksAndTakesAnyAnswer(): void {
    const steering = new GrokSteering();

    Assert.areEqual(Resources.xaiInterjectMethods.join(), steering.methods.join());
    Assert.areEqual(JSON.stringify({ sessionId: "s1", text: "Hi", content: [{ type: "text", text: "Hi" }] }),
      JSON.stringify(steering.paramsOf("s1", new TurnSteer("Hi", []), [{ type: "text", text: "Hi" }])));
    Assert.isTrue(steering.took(JsonReader.fromValue({ status: "queued" })));
  }
}
