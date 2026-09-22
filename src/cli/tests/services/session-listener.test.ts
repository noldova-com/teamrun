/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Event } from "@noldova/teamrun-protocol";
import { SessionListener } from "@noldova/teamrun-cli";

@TestClass
export class SessionListenerTests {
  @TestMethod
  public fansEventsOutAndRecordsTheDisconnection(): void {
    const listener = new SessionListener();
    const names: string[] = [];
    const subscription = listener.subscribe({ handleEvent: event => names.push(event.name) });

    listener.onEvent(new Event("a", null));
    subscription[Symbol.dispose]();
    listener.onEvent(new Event("b", null));
    listener.onDisconnected();

    Assert.areEqual("a", names.join(","));
    Assert.isTrue(listener.isDisconnected);
  }
}
