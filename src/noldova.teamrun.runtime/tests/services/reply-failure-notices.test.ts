/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandRun, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  ConversationIdParams,
  DetailKind,
  Event,
  EventName,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  ObservedSettings,
  Provenance,
  RequestedSettings
} from "@noldova/teamrun.protocol";
import { ReplyFailureNotices, Resources } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { RecordingPartContext } from "../fixtures/recording-part-context.fixture.js";

class ShownWindows {
  public readonly shown: Set<string> = new Set();
  public readonly listeners: Set<(conversationId: string) => void> = new Set();

  public isShown(conversationId: string): boolean {
    return this.shown.has(conversationId);
  }

  public onShown(listener: (conversationId: string) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  public show(conversationId: string): void {
    this.shown.add(conversationId);
    for (const listener of [...this.listeners])
      listener(conversationId);
  }
}

@TestClass
export class ReplyFailureNoticesTests {
  private static readonly time: string = "2026-10-24T08:00:00.000Z";

  @TestMethod
  public postsAReplyThatFailedWhileNoWindowShowsItsChatAndDismissesItOnceAWindowShowsIt(): void {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database);
    const windows = new ShownWindows();
    windows.shown.add("c2");
    using notices = new ReplyFailureNotices(context, windows);

    notices.onEvent(ReplyFailureNoticesTests.updated("m1", "c1", MessageAuthor.Provider, MessageStatus.Failed, "Alice", "The provider stopped."));
    notices.onEvent(ReplyFailureNoticesTests.updated("m2", "c2", MessageAuthor.Provider, MessageStatus.Failed, "Bob", "Offline"));
    notices.onEvent(ReplyFailureNoticesTests.updated("m3", "c3", MessageAuthor.Provider, MessageStatus.Completed, "Bob", null));
    notices.onEvent(ReplyFailureNoticesTests.updated("m4", "c4", MessageAuthor.User, MessageStatus.Failed, null, null));
    const created = ReplyFailureNoticesTests.message("m5", "c5", MessageAuthor.Provider, MessageStatus.Failed, null, null);
    notices.onEvent(new Event(EventName.MessageCreated, created.toJson()));
    const posted = context.shownNotices();
    windows.show("c1");

    Assert.areEqual(JSON.stringify([["teamrun.replyFailed", "c1", "Alice's reply failed", "The provider stopped.", NotificationSeverity.Error, []]]),
      JSON.stringify(posted.map(t => [t.kind.text, t.key, t.title, t.text, t.severity, t.actions])));
    const open = new CommandRun(QualifiedName.parse("teamrun.openChat"), { chatId: "c1" });
    Assert.areEqual(JSON.stringify(open.toJson()), JSON.stringify(posted[0]?.open?.toJson()));
    Assert.areEqual(0, context.shownNotices().length);
  }

  @TestMethod
  public replacesAChatsNoticeOnItsNextFailureAndDismissesItWithTheChatOrOnDisposal(): void {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database);
    const windows = new ShownWindows();
    const notices = new ReplyFailureNotices(context, windows);

    notices.onEvent(ReplyFailureNoticesTests.updated("m1", "c1", MessageAuthor.Provider, MessageStatus.Failed, null, " "));
    notices.onEvent(ReplyFailureNoticesTests.updated("m2", "c1", MessageAuthor.Provider, MessageStatus.Failed, "Alice", "Offline"));
    notices.onEvent(ReplyFailureNoticesTests.updated("m3", "c2", MessageAuthor.Provider, MessageStatus.Failed, null, null));
    const replaced = context.shownNotices().map(t => [t.key, t.title, t.text]);
    notices.onEvent(new Event(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson()));
    const afterDelete = context.shownNotices().map(t => t.key);
    notices[Symbol.dispose]();
    windows.show("c2");

    Assert.areEqual(JSON.stringify([["c1", "Alice's reply failed", "Offline"], ["c2", "A reply failed", null]]), JSON.stringify(replaced));
    Assert.areEqual(JSON.stringify(["teamrun.replyFailed", "A reply failed", null]),
      JSON.stringify([context.notifications[0]?.post.kind.text, context.notifications[0]?.post.title, context.notifications[0]?.post.text]));
    Assert.areEqual("c2", afterDelete.join(","));
    Assert.areEqual(0, context.shownNotices().length);
    Assert.areEqual(0, windows.listeners.size);
  }

  @TestMethod
  public logsANoticeDesktopCoreRefusesByItsKindAndGoesOn(): void {
    using database = new MemoryModuleDatabase();
    const context = new RecordingPartContext("/module", database);
    using notices = new ReplyFailureNotices(context, new ShownWindows());
    context.notificationFailure = new TypeError("refused");

    notices.onEvent(ReplyFailureNoticesTests.updated("m1", "c1", MessageAuthor.Provider, MessageStatus.Failed, null, null));

    Assert.areEqual(Resources.formatNoticeNotPosted("teamrun.replyFailed", "TypeError"), context.lines.join("\n"));
    Assert.areEqual(0, context.notifications.length);
  }

  private static updated(id: string, conversationId: string, author: MessageAuthor, status: MessageStatus, teammateName: string | null,
    error: string | null): Event {
    return new Event(EventName.MessageUpdated, ReplyFailureNoticesTests.message(id, conversationId, author, status, teammateName, error).toJson());
  }

  private static message(id: string, conversationId: string, author: MessageAuthor, status: MessageStatus, teammateName: string | null,
    error: string | null): Message {
    const time = ReplyFailureNoticesTests.time;
    const details = Object.isNull(error) ? [] : [new MessageDetail(0, DetailKind.Text, "Working", null, time),
      new MessageDetail(1, DetailKind.Error, error, null, time)];
    const isUser = author === MessageAuthor.User;
    const provenance = isUser ? null : new Provenance("a1", new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null), null, false);
    return new Message(id, conversationId, 1, author, isUser ? null : "m0", status, details, provenance, time, isUser ? null : time, time, [],
      Object.isNull(teammateName) ? null : teammateName.toLowerCase(), teammateName);
  }
}
