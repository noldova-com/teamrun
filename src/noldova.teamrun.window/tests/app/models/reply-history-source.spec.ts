/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Message, MessageAuthor, MessageStatus, ReplySummary } from "@noldova/teamrun.protocol";
import type { IVirtualListObserver } from "@noldova/ui.components.angular";

import { SampleData } from "../../fixtures/sample-data.fixture";
import { ReplyHistorySource } from "../../../src/app/models/reply-history-source";
import { Resources } from "../../../src/resources";

class ChangeLog implements IVirtualListObserver {
  public readonly changes: string[] = [];

  public onInserted(at: number, count: number): void {
    this.changes.push(`+${at}:${count}`);
  }

  public onRemoved(at: number, count: number): void {
    this.changes.push(`-${at}:${count}`);
  }

  public onUpdated(at: number, count: number): void {
    this.changes.push(`~${at}:${count}`);
  }
}

describe("ReplyHistorySource", () => {
  const reply = (sequence: number, status: MessageStatus = MessageStatus.Completed): ReplySummary =>
    ReplySummary.fromMessage(SampleData.withStatus(new Message(`r${sequence}`, "c1", sequence, MessageAuthor.Provider, null, MessageStatus.Running, [],
      SampleData.provenance, SampleData.timestamp, SampleData.timestamp, null), status));
  const replies = (...sequences: number[]): ReplySummary[] => sequences.map(t => reply(t));
  const ids = (source: ReplyHistorySource): string[] => source.items.map(t => t.preview.id);

  it("reads its replies oldest first by range from a newest-first page, keys each by its message's id, and names its oldest", async () => {
    const source = new ReplyHistorySource(replies(5, 3, 1));

    expect(source.length()).toBe(3);
    expect(source.estimate).toBe(Resources.replyEstimate);
    expect((await source.readAsync(1, 3)).map(t => source.keyOf(t))).toEqual(["r3", "r5"]);
    expect(source.oldest?.preview.id).toBe("r1");
    expect(source.has("r3")).toBe(true);
    expect(source.has("r4")).toBe(false);
    expect(new ReplyHistorySource([]).oldest).toBeNull();
  });

  it("puts an older page at its start, oldest first, skipping replies it holds", () => {
    const source = new ReplyHistorySource(replies(5, 3));
    const log = new ChangeLog();
    source.observe(log);

    source.addOlder(replies(3, 1, 0));
    source.addOlder(replies(1));

    expect(ids(source)).toEqual(["r0", "r1", "r3", "r5"]);
    expect(log.changes).toEqual(["+0:2"]);
  });

  it("puts a new reply at its place by sequence, and replaces one it holds where it is", () => {
    const source = new ReplyHistorySource(replies(5, 1));
    const log = new ChangeLog();
    source.observe(log);

    source.put(reply(7));
    source.put(reply(3));
    source.put(reply(0));
    source.put(reply(3, MessageStatus.Failed));

    expect(ids(source)).toEqual(["r0", "r1", "r3", "r5", "r7"]);
    expect(source.items[2]?.preview.status).toBe(MessageStatus.Failed);
    expect(log.changes).toEqual(["+2:1", "+1:1", "+0:1", "~2:1"]);
  });

  it("removes a reply it holds, and ignores one it doesn't", () => {
    const source = new ReplyHistorySource(replies(5, 3, 1));
    const log = new ChangeLog();
    source.observe(log);

    source.remove("r3");
    source.remove("r9");

    expect(ids(source)).toEqual(["r1", "r5"]);
    expect(log.changes).toEqual(["-1:1"]);
  });
});
