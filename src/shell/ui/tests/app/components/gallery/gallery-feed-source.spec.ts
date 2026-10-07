/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GalleryFeedSource } from "../../../../src/app/components/gallery/gallery-feed-source";
import type { IVirtualListObserver } from "../../../../src/app/interfaces/i-virtual-list-observer";

describe("GalleryFeedSource", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers its newest messages at once, each with an author, a place and text of its own length, and a code sample in every ninth", async () => {
    const source = new GalleryFeedSource(10_000, 1500);

    const messages = await source.readAsync(9_950, 10_000);
    const [first, second] = messages;

    expect([messages.length, first?.heading, second?.heading, messages.slice(0, 2).map(t => source.keyOf(t))]).toEqual([50, "Linus · message 9951", "Ada · message 9952", ["9950", "9951"]]);
    expect([first?.text.split(" ").length, second?.text.split(" ").length, messages.filter(t => t.code !== null).map(t => t.key)]).toEqual([4 + 9950 * 7 % 40, 4 + 9951 * 7 % 40, ["9958", "9967", "9976", "9985", "9994"]]);
    expect(messages.find(t => t.code !== null)?.code).toBe("const message = 9959;\nconsole.log(message);");
  });

  it("answers older messages only after its delay", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const source = new GalleryFeedSource(10_000, 1500);
    let answered: number | null = null;

    const reading = source.readAsync(0, 50).then(t => {
      answered = t.length;
    });
    await vi.advanceTimersByTimeAsync(1499);
    const early = answered;
    await vi.advanceTimersByTimeAsync(1);
    await reading;

    expect([early, answered]).toEqual([null, 50]);
  });

  it("adds a reply at its end and grows it word by word, telling its observers", async () => {
    const source = new GalleryFeedSource(10, 1500);
    const changes: string[] = [];
    const observer: IVirtualListObserver = {
      onInserted: (at, count) => changes.push(`inserted ${at} ${count}`),
      onRemoved: () => undefined,
      onUpdated: (at, count) => changes.push(`updated ${at} ${count}`)
    };
    source.observe(observer);

    const index = source.startReply();
    const empty = (await source.readAsync(index, index + 1))[0]?.text;
    source.extendReply(index, "the");
    source.extendReply(index, "build");
    const [reply] = await source.readAsync(index, index + 1);

    expect([index, source.length(), empty, reply?.heading, reply?.text, reply?.code, changes]).toEqual([10, 11, "", "TeamRun · message 11", "the build", null, ["inserted 10 1", "updated 10 1", "updated 10 1"]]);
  });
});
