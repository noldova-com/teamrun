/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventChannel } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import { Event } from "@noldova/teamrun.protocol";
import { EventForwarder } from "@noldova/teamrun.runtime";

@TestClass
export class EventForwarderTests {
  @TestMethod
  public publishesAnEventOnItsChannelAndLeavesOutOneWithoutAChannel(): void {
    const published: JsonValue[] = [];
    const forwarder = new EventForwarder(new Map([["MessageCreated", new EventChannel(t => published.push(t), () => undefined)]]));

    forwarder.onEvent(new Event("MessageCreated", { id: "msg-1" }));
    forwarder.onEvent(new Event("ReplyThinking", null));

    Assert.areEqual("[{\"id\":\"msg-1\"}]", JSON.stringify(published));
  }
}
