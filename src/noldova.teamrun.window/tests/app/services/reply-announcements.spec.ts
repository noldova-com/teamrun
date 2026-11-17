/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { DetailKind, Message, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, Announcer } from "@noldova/ui.components.angular";

import { ReplyAnnouncements } from "../../../src/app/services/reply-announcements";
import { Resources } from "../../../src/resources";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("ReplyAnnouncements", () => {
  const reply = SampleData.reply;
  const other = new Message("m3", "c2", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null);
  const none = (): Message | null => null;
  let said: unknown[][];
  let announcements: ReplyAnnouncements;

  beforeEach(() => {
    const announcer = TestBed.inject(Announcer);
    said = [];
    vi.spyOn(announcer, "announce").mockImplementation((...t) => void said.push(t));
    announcements = new ReplyAnnouncements(announcer, () => "Alice");
  });

  afterEach(() => vi.restoreAllMocks());

  it("says politely that the teammate replied when a reply of the chat on screen completes, and nothing while it streams", () => {
    announcements.update("c1", true, [reply], [], none);
    announcements.update("c1", true, [SampleData.withStatus(reply, MessageStatus.Running, [SampleData.detail(0, DetailKind.Text, "Half a")])], [], none);
    const streaming = [...said];
    announcements.ended(SampleData.withStatus(reply, MessageStatus.Completed));

    expect([streaming, said]).toEqual([[], [[Resources.formatReplied("Alice"), AnnouncementPoliteness.Polite, { key: `${Resources.replyEndedKeyPrefix}${reply.id}` }]]]);
  });

  it.each([MessageStatus.Cancelled, MessageStatus.Failed, MessageStatus.Interrupted, MessageStatus.Pending])("says nothing when a reply of the chat on screen ends %s", status => {
    announcements.update("c1", true, [reply], [], none);
    announcements.ended(SampleData.withStatus(reply, status));

    expect(said).toEqual([]);
  });

  it("says once, politely, what the teammate asks when an approval or question card appears in a working reply of the chat on screen", () => {
    announcements.update("c1", true, [reply], [], none);
    announcements.update("c1", true, [reply], [SampleData.approval], none);
    announcements.update("c1", true, [reply], [SampleData.approval], none);

    expect(said).toEqual([[Resources.formatAsks("Alice", "Run a command"), AnnouncementPoliteness.Polite, { key: `${Resources.approvalAskedKeyPrefix}${SampleData.approval.id}` }]]);
  });

  it("says what the teammate asks when a card appears in a reply of the chat on screen that has ended", () => {
    const ended = SampleData.withStatus(reply, MessageStatus.Completed);
    const find = (messageId: string): Message | null => messageId === ended.id ? ended : null;
    announcements.update("c1", true, [], [], find);
    announcements.update("c1", true, [], [SampleData.approval], find);

    expect(said).toEqual([[Resources.formatAsks("Alice", "Run a command"), AnnouncementPoliteness.Polite, { key: `${Resources.approvalAskedKeyPrefix}${SampleData.approval.id}` }]]);
  });

  it("says nothing for a chat off screen, another chat's reply, a card whose reply it can't find, or what was already there when it started", () => {
    announcements.ended(SampleData.withStatus(reply, MessageStatus.Completed));
    announcements.update("c1", true, [reply], [SampleData.approval], none);
    announcements.update("c1", false, [], [], none);
    announcements.ended(SampleData.withStatus(reply, MessageStatus.Completed));
    announcements.update("c1", true, [other], [], none);
    announcements.ended(SampleData.withStatus(other, MessageStatus.Completed));
    announcements.update("c1", true, [], [SampleData.approval], none);

    expect(said).toEqual([]);
  });
});
