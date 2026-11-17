/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConversationIdParams, Event, EventName } from "@noldova/teamrun.protocol";
import { ChatTerminalsCloser } from "@noldova/teamrun.runtime";

import { RecordingTerminalOwners } from "../fixtures/recording-terminal-owners.fixture.js";

@TestClass
export class ChatTerminalsCloserTests {
  @TestMethod
  public closesADeletedChatsTerminalsByItsOwnerAndLeavesOtherEventsAlone(): void {
    const owners = new RecordingTerminalOwners();
    const lines: string[] = [];
    const closer = new ChatTerminalsCloser(() => owners, { write: t => lines.push(t) });

    closer.onEvent(new Event(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson()));
    closer.onEvent(new Event(EventName.ConversationRewound, new ConversationIdParams("c2").toJson()));

    Assert.areEqual("teamrun.chat/c1", owners.closed.join(","));
    Assert.areEqual(0, lines.length);
  }

  @TestMethod
  public async logsAChatWhoseTerminalsCouldNotBeClosedOrWhenTerminalIsMissing(): Promise<void> {
    const owners = new RecordingTerminalOwners();
    owners.failure = new TypeError("closed twice");
    const lines: string[] = [];
    const failing = new ChatTerminalsCloser(() => owners, { write: t => lines.push(t) });
    const missing = new ChatTerminalsCloser(() => {
      throw new RangeError("no terminal.owners");
    }, { write: t => lines.push(t) });

    failing.onEvent(new Event(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson()));
    missing.onEvent(new Event(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson()));
    await new Promise(resolve => setImmediate(resolve));

    Assert.areEqual("The terminals of deleted chat c1 could not be closed (TypeError).|The terminals of deleted chat c2 could not be closed (RangeError).",
      [...lines].sort().join("|"));
  }
}
