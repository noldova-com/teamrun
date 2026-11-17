/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Message, MessageAuthor, MessagePage, MessageStatus } from "@noldova/teamrun.protocol";
import type { IVirtualListObserver } from "@noldova/ui.components.angular";

import { SampleData } from "../../fixtures/sample-data.fixture";
import { HistoryReadException } from "../../../src/app/exceptions/history-read.exception";
import { ConversationHistorySource } from "../../../src/app/models/conversation-history-source";
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

describe("ConversationHistorySource", () => {
  const message = (sequence: number, status: MessageStatus = MessageStatus.Completed): Message =>
    SampleData.withStatus(new Message(`m${sequence}`, "c1", sequence, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null,
      SampleData.timestamp), status);
  const range = (start: number, end: number): Message[] => Array.from({ length: end - start }, (_, index) => message(start + index));
  const page = (messages: readonly Message[], count: number): MessagePage => new MessagePage(messages, (messages[0]?.sequence ?? 0) > 0,
    (messages.at(-1)?.sequence ?? count) < count - 1, count);

  it("stands for the whole conversation from its first page, and keys each row by its message's id", () => {
    const source = new ConversationHistorySource(page(range(8, 10), 10), () => Promise.resolve([]));

    expect(source.length()).toBe(10);
    expect(source.keyOf(message(7))).toBe("m7");
    expect(source.find("m9")?.sequence).toBe(9);
    expect(source.find("m0")).toBeNull();
    expect(source.heldAt(9)?.id).toBe("m9");
    expect(source.heldAt(0)).toBeNull();
    expect(source.held.map(t => t.id)).toEqual(["m8", "m9"]);
  });

  it("serves the rows it holds without reading, and reads the others once", async () => {
    const reads: string[] = [];
    const source = new ConversationHistorySource(page(range(8, 10), 10), (start, end) => {
      reads.push(`${start}-${end}`);
      return Promise.resolve(range(start, end));
    });

    expect((await source.readAsync(8, 10)).map(t => t.id)).toEqual(["m8", "m9"]);
    expect((await source.readAsync(0, 3)).map(t => t.id)).toEqual(["m0", "m1", "m2"]);
    expect((await source.readAsync(1, 3)).map(t => t.id)).toEqual(["m1", "m2"]);
    expect(reads).toEqual(["0-3"]);
  });

  it("fails a read whose messages are not the range's, in order", async () => {
    const answers: Message[][] = [[message(0), message(2)], [message(0)]];
    const source = new ConversationHistorySource(page([], 10), () => Promise.resolve(answers.shift() ?? []));

    await expect(source.readAsync(0, 2)).rejects.toThrow("The messages from 0 to 1 did not come back in order.");
    await expect(source.readAsync(0, 2)).rejects.toBeInstanceOf(HistoryReadException);
    await expect(source.readAsync(0, 2)).rejects.toMatchObject({ start: 0, end: 2 });
    expect(source.find("m0")).toBeNull();
  });

  it("keeps a row a change reached during a read, and holds no row a removal took meanwhile", async () => {
    let answer: (messages: readonly Message[]) => void = () => undefined;
    const source = new ConversationHistorySource(page([], 3), () => new Promise(resolve => answer = resolve));
    const reading = source.readAsync(0, 3);
    const running = message(1, MessageStatus.Running);

    source.upsert(running);
    source.removeFrom(2);
    answer(range(0, 3));

    expect((await reading)[1]).toBe(running);
    expect(source.find("m2")).toBeNull();
    expect((await source.readAsync(0, 2)).map(t => t.id)).toEqual(["m0", "m1"]);
  });

  it("adds rows up to a message past its last row, and reports a change to a row before it", () => {
    const source = new ConversationHistorySource(page(range(8, 10), 10), () => Promise.resolve([]));
    const log = new ChangeLog();
    source.observe(log);
    const running = message(9, MessageStatus.Running);

    source.upsert(message(10));
    source.upsert(message(13));
    source.upsert(running);

    expect(log.changes).toEqual(["+10:1", "+11:3", "~9:1"]);
    expect(source.length()).toBe(14);
    expect(source.find("m9")).toBe(running);
  });

  it("holds only a page read again, and has the list read its rows again, as many as the page counts", async () => {
    const reads: string[] = [];
    const source = new ConversationHistorySource(page(range(8, 10), 10), (start, end) => {
      reads.push(`${start}-${end}`);
      return Promise.resolve(range(start, end));
    });
    const log = new ChangeLog();
    source.observe(log);
    const running = message(11, MessageStatus.Running);

    source.refresh(page([message(10), running], 12));
    source.refresh(page([message(5)], 6));
    source.refresh(page([], 0));

    expect(log.changes).toEqual(["+10:2", "~0:10", "-6:6", "~0:6", "-0:6"]);
    expect(source.length()).toBe(0);
    source.refresh(page(range(0, 2), 2));
    expect(source.held.map(t => t.id)).toEqual(["m0", "m1"]);
    expect((await source.readAsync(0, 2)).map(t => t.id)).toEqual(["m0", "m1"]);
    expect(reads).toEqual([]);
  });

  it("holds the newest page only once it holds every row of the conversation's last page, read or added, and for a conversation shorter than a page", async () => {
    const size = Resources.messagePageSize;
    const count = 3 * size;
    const source = new ConversationHistorySource(page(range(10, 10 + size), count), (start, end) => Promise.resolve(range(start, end)));

    expect(source.holdsNewest()).toBe(false);
    await source.readAsync(count - size, count - 1);
    expect(source.holdsNewest()).toBe(false);
    await source.readAsync(count - 1, count);
    expect(source.holdsNewest()).toBe(true);
    source.upsert(message(count));
    expect(source.holdsNewest()).toBe(true);
    expect(new ConversationHistorySource(page(range(0, 3), 3), () => Promise.resolve([])).holdsNewest()).toBe(true);
    expect(new ConversationHistorySource(page(range(1, 3), 3), () => Promise.resolve([])).holdsNewest()).toBe(false);
  });

  it("counts each change to the rows it holds, and not a removal past its last row", () => {
    const source = new ConversationHistorySource(page(range(8, 10), 10), () => Promise.resolve([]));
    const revisions = [source.revision()];

    source.upsert(message(9, MessageStatus.Running));
    revisions.push(source.revision());
    source.refresh(page(range(8, 11), 11));
    revisions.push(source.revision());
    source.removeFrom(9);
    revisions.push(source.revision());
    source.removeFrom(12);
    revisions.push(source.revision());

    expect(revisions).toEqual([0, 1, 2, 3, 3]);
  });

  it("removes the rows from a sequence on, and returns the ids of those it held", () => {
    const source = new ConversationHistorySource(page(range(8, 10), 10), () => Promise.resolve([]));
    const log = new ChangeLog();
    source.observe(log);

    expect(source.removeFrom(5)).toEqual(["m8", "m9"]);
    expect(source.removeFrom(5)).toEqual([]);
    expect(log.changes).toEqual(["-5:5"]);
    expect(source.length()).toBe(5);
  });

  it("forgets the rows far from its last read once it holds more than a thousand, but keeps the newest page", async () => {
    const source = new ConversationHistorySource(page(range(2950, 3000), 3000), (start, end) => Promise.resolve(range(start, end)));
    source.upsert(message(2200));

    for (let start = 0; start < 1100; start += 50)
      await source.readAsync(start, start + 50);

    expect(source.find("m49")).toBeNull();
    expect(source.find("m50")?.sequence).toBe(50);
    expect(source.find("m1099")?.sequence).toBe(1099);
    expect(source.find("m2200")).toBeNull();
    expect(source.find("m2950")?.sequence).toBe(2950);
  });
});
