/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EventHub, EventSubscription } from "@noldova/teamrun-core";
import { Event, EventName } from "@noldova/teamrun-protocol";

import { RecordingEventListener } from "../../fixtures/recording-event-listener.fixture.js";

@TestClass
export class EventHubTests {
  @TestMethod
  public deliversToEverySubscriberUntilDisposed(): void {
    const hub = new EventHub();
    const first = new RecordingEventListener();
    const second = new RecordingEventListener();
    const subscription = hub.subscribe(first);
    using other = hub.subscribe(second);

    hub.publish(new Event(EventName.MessageCreated, { id: "m1" }));
    subscription[Symbol.dispose]();
    hub.publish(new Event(EventName.MessageUpdated, { id: "m1" }));

    Assert.isInstanceOf(subscription, EventSubscription);
    Assert.isFalse(subscription.isActive);
    Assert.isTrue(other.isActive);
    Assert.areEqual(1, hub.listenerCount);
    Assert.areEqual("MessageCreated", first.names().join(","));
    Assert.areEqual("MessageCreated,MessageUpdated", second.names().join(","));
    Assert.areEqual(1, second.count(EventName.MessageUpdated));
  }
}
