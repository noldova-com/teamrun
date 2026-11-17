/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ChatIds } from "../../../src/app/models/chat-ids";
import { Resources } from "../../../src/resources";

describe("ChatIds", () => {
  const release = "0192e4f0-7c1a-7b2e-9d3f-5a6b7c8d9e0f";
  const other = "0192e4f0-7c1a-7b2e-9d3f-000000000000";
  const pieces = [release, release.toUpperCase(), other, " ", " ", "\n", "-", "/", ".", "x", "a", ".a", "`"];
  const textOf = (seed: number): string => {
    let state = seed;
    return Array.from({ length: 1 + seed % 30 }, () => {
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      return pieces[(state >>> 16) % pieces.length];
    }).join("");
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds the ids of a text grown a character at a time as a scan of the whole text does, at every step", () => {
    const texts = Array.from({ length: 300 }, (_, i) => textOf(i + 1));
    const differ = texts.flatMap(text => {
      let ids = ChatIds.none;
      return Array.from({ length: text.length }, (_, i) => {
        ids = ids.extendedTo(text.slice(0, i + 1));
        return ids;
      }).filter(t => JSON.stringify(t.found) !== JSON.stringify(ChatIds.of(t.text).found)).map(t => t.text);
    });

    expect(differ).toEqual([]);
    expect(texts.filter(t => ChatIds.of(t).found.length > 0).length).toBeGreaterThan(texts.length / 5);
  });

  it("scans again only the end of a text it scanned before, where an id may still change, nothing for the same text, and all of a text that replaced it", () => {
    const text = `${"See the plan. ".repeat(40)}${release} then ${"more words ".repeat(20)}`;
    const first = ChatIds.of(text);
    const scans = vi.spyOn(String.prototype, "matchAll");

    const grown = first.extendedTo(`${text}and ${release}.`);
    const same = grown.extendedTo(grown.text);
    const replaced = grown.extendedTo(`New ${release}`);

    expect(scans.mock.calls.map(([pattern]) => pattern.lastIndex)).toEqual([text.length - Resources.chatIdTail, 0]);
    expect(same).toBe(grown);
    expect([first.found, grown.found, replaced.found]).toEqual([[[560, release]], [[560, release], [text.length + 4, release]], [[4, release]]]);
  });
});
