/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConversationIdParams, Event, EventName } from "@noldova/teamrun.protocol";
import { ChatPagesRemover } from "@noldova/teamrun.runtime";

@TestClass
export class ChatPagesRemoverTests {
  @TestMethod
  public async removesADeletedChatsPagesThroughThePagesApiAndLeavesOtherEventsAlone(): Promise<void> {
    const removed: string[] = [];
    const lines: string[] = [];
    const removal = Promise.resolve();
    const remover = new ChatPagesRemover({
      removeChatAsync: t => {
        removed.push(t);
        return removal;
      }
    }, { write: t => lines.push(t) });

    remover.onEvent(new Event(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson()));
    remover.onEvent(new Event(EventName.ConversationRewound, new ConversationIdParams("c2").toJson()));
    await removal;

    Assert.areEqual("c1", removed.join());
    Assert.areEqual(0, lines.length);
  }

  @TestMethod
  public async logsAChatWhosePagesCouldNotBeRemovedForTheSweepToFinish(): Promise<void> {
    const lines: string[] = [];
    const removal = Promise.reject(new TypeError("busy"));
    const remover = new ChatPagesRemover({ removeChatAsync: () => removal }, { write: t => lines.push(t) });

    remover.onEvent(new Event(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson()));
    await removal.catch(() => undefined);

    Assert.areEqual("The pages of deleted chat c1 could not be removed (TypeError).", lines.join("|"));
  }
}
