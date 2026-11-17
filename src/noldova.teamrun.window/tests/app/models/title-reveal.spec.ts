/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TitleReveal } from "../../../src/app/models/title-reveal";

describe("TitleReveal", () => {
  const frame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve));
  const titles = (...pairs: (readonly [string, string])[]): ReadonlyMap<string, string> => new Map(pairs);
  const grow = async (reveal: TitleReveal, key: string, title: string): Promise<readonly string[]> => {
    const seen = [reveal.shownOf(key, title)];
    for (let index = 0; index < 600 && seen.at(-1) !== title; index++) {
      await frame();
      const shown = reveal.shownOf(key, title);
      if (shown !== seen.at(-1))
        seen.push(shown);
    }
    return seen;
  };
  const isGrowing = (seen: readonly string[], title: string): boolean =>
    seen.every((shown, index) => title.startsWith(shown) && shown.length > (index === 0 ? 0 : seen[index - 1]?.length ?? 0));
  let changes = 0;
  let reveal = new TitleReveal(() => {
    changes += 1;
  });

  beforeEach(() => {
    changes = 0;
    reveal = new TitleReveal(() => {
      changes += 1;
    });
  });

  afterEach(() => reveal.dispose());

  it("starts a new title at its first letter while a reply streams, grows it a little each frame to the whole title and tells each change", async () => {
    reveal.follow(titles(["1", "Read: a.ts"]), new Set(), true, true);

    const seen = await grow(reveal, "1", "Read: a.ts");
    expect(seen[0]).toBe("R");
    expect(seen.length).toBeGreaterThan(2);
    expect(isGrowing(seen, "Read: a.ts")).toBe(true);
    expect(seen.at(-1)).toBe("Read: a.ts");
    expect(changes).toBeGreaterThanOrEqual(seen.length - 1);
  });

  it("shows a title whole when it was there from the start, when nothing streams and under reduced motion", () => {
    reveal.follow(titles(["1", "> ls"]), new Set(["1"]), true, true);
    expect(reveal.shownOf("1", "> ls")).toBe("> ls");

    reveal.follow(titles(["1", "> ls"], ["2", "> pwd"]), new Set(), false, true);
    expect(reveal.shownOf("2", "> pwd")).toBe("> pwd");

    reveal.follow(titles(["1", "> ls"], ["2", "> pwd"], ["3", "> make"]), new Set(), true, false);
    expect([reveal.shownOf("1", "> ls"), reveal.shownOf("2", "> pwd"), reveal.shownOf("3", "> make")]).toEqual(["> ls", "> pwd", "> make"]);
  });

  it("grows a title whose text grows from where it was, and starts a title whose text changes again at its first letter, also one there from the start", async () => {
    reveal.follow(titles(["1", "Read"]), new Set(), true, true);
    await grow(reveal, "1", "Read");

    reveal.follow(titles(["1", "Read: a.ts"]), new Set(), true, true);
    expect(reveal.shownOf("1", "Read: a.ts")).toBe("Read");
    const seen = await grow(reveal, "1", "Read: a.ts");
    expect(isGrowing(seen, "Read: a.ts")).toBe(true);
    expect(seen.at(-1)).toBe("Read: a.ts");

    reveal.follow(titles(["1", "Write: b.ts"]), new Set(["1"]), true, true);
    expect(reveal.shownOf("1", "Write: b.ts")).toBe("W");
  });

  it("starts a title that begins with spaces at its first letter", () => {
    reveal.follow(titles(["1", "  ls"]), new Set(), true, true);

    expect(reveal.shownOf("1", "  ls")).toBe("  l");
  });

  it("gives a title it does not follow, or one it follows under other text, as it is", () => {
    expect(reveal.shownOf("1", "> ls")).toBe("> ls");

    reveal.follow(titles(["1", "> ls"]), new Set(), true, true);
    expect(reveal.shownOf("1", "> pwd")).toBe("> pwd");
  });

  it("forgets a title it no longer follows, and tells no more changes once disposed", async () => {
    reveal.follow(titles(["1", "> make all"]), new Set(), true, true);
    reveal.follow(titles(), new Set(), true, true);
    expect(reveal.shownOf("1", "> make all")).toBe("> make all");

    reveal.follow(titles(["2", "> make all"]), new Set(), true, true);
    reveal.dispose();
    const told = changes;
    await frame();
    await frame();
    expect(changes).toBe(told);
    expect(reveal.shownOf("2", "> make all")).toBe("> make all");
  });

});
