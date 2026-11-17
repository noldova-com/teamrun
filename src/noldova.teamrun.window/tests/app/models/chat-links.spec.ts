/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ChatIds } from "../../../src/app/models/chat-ids";
import { ChatLinks } from "../../../src/app/models/chat-links";
import { Resources } from "../../../src/resources";

describe("ChatLinks", () => {
  const release = "0192e4f0-7c1a-7b2e-9d3f-5a6b7c8d9e0f";
  const other = "0192e4f0-7c1a-7b2e-9d3f-000000000000";
  const titles = new Map([[release, "Release plan"], ["0192e4f0-7c1a-7b2e-9d3f-111111111111", "Fix *all* [the] `bugs`_now"]]);
  const titleOf = (chatId: string): string | null => titles.get(chatId) ?? null;
  const linked = (text: string, isWhole: boolean = true): string => ChatLinks.linked(ChatIds.of(text), titleOf, isWhole);
  const link = `[Release plan](teamrun-chat:${release})`;

  it("shows a known chat's id as a link titled with the chat's name, and leaves an unknown one as text", () => {
    expect(linked(`Astra messaged me from chat ${release}, not ${other}.`)).toBe(`Astra messaged me from chat ${link}, not ${other}.`);
    expect(linked(`(${release.toUpperCase()})`)).toBe(`(${link})`);
    expect(linked(`${release}\n${release}`)).toBe(`${link}\n${link}`);
  });

  it("escapes the Markdown in a chat's title, so the link shows the title as it is", () => {
    expect(linked("See 0192e4f0-7c1a-7b2e-9d3f-111111111111")).toBe("See [Fix \\*all\\* \\[the\\] \\`bugs\\`\\_now](teamrun-chat:0192e4f0-7c1a-7b2e-9d3f-111111111111)");
  });

  it("leaves an id as text inside code, a link, an autolink and a web address", () => {
    const kept = [
      `Run \`teamrun send ${release} hi\` there.`,
      `\`\`\`\nteamrun send ${release}\n\`\`\``,
      `~~~ sh\n\`\`\`\n${release}\n~~~~`,
      `    teamrun send ${release}`,
      `\tteamrun send ${release}`,
      `[the chat ${release}](https://example.com/chats/${release})`,
      `![shot](${release}.png)`,
      `<https://example.com/${release}>`,
      `https://example.com/chats?id=${release}`,
      `www.example.com/${release}`
    ];

    expect(kept.map(t => linked(t))).toEqual(kept);
    expect(linked(`\`\`\`\n${release}\n\`\`\`\nThen ${release}`)).toBe(`\`\`\`\n${release}\n\`\`\`\nThen ${link}`);
  });

  it("leaves an id as text inside a longer token, such as a path or a longer hex string", () => {
    const kept = [`chats/${release}/messages`, `C:\\chats\\${release}`, `${release}.json`, `ab${release}`, `${release}0`, `${release}-x`, `x-${release}`,
      `#${release}`, `@${release}`, `chat:${release}`];

    expect(kept.map(t => linked(t))).toEqual(kept);
  });

  it("links an id only once it's whole while the reply streams", () => {
    expect(linked(`from chat ${release.slice(0, 20)}`, false)).toBe(`from chat ${release.slice(0, 20)}`);
    expect(linked(`from chat ${release}`, false)).toBe(`from chat ${release}`);
    expect(linked(`from chat ${release}5`, false)).toBe(`from chat ${release}5`);
    expect(linked(`from chat ${release} and`, false)).toBe(`from chat ${link} and`);
    expect(linked(`from chat ${release}`)).toBe(`from chat ${link}`);
  });

  it("leaves an id as text after a code span, link or autolink whose closing mark hasn't arrived while the reply streams, and links it once the reply ends", () => {
    const open = [
      `Run \`teamrun send ${release} hi`,
      `Run \`\`teamrun \` send ${release} hi`,
      `See [the chat ${release} and`,
      `See [the chat ${release}]`,
      `See [the chat](notes?id=${release}&x`,
      `See [the chat][${release} and`,
      `Mail <mailto:team@example.com?subject=${release}&x`
    ];

    expect(open.map(t => linked(t, false))).toEqual(open);
    expect(linked(`Run \`teamrun send ${release} hi`)).toBe(`Run \`teamrun send ${link} hi`);
    expect(linked(`Run \`x\` and [note] then ${release} and`, false)).toBe(`Run \`x\` and [note] then ${link} and`);
    expect(linked(`From ${release} run \`teamrun`, false)).toBe(`From ${link} run \`teamrun`);
  });

  it("finds the open code span or link after many code lines and closed literals while the reply streams", () => {
    const code = Array.from({ length: 200 }, (_, i) => `const chat${i} = "${release}";`).join("\n");
    const spans = Array.from({ length: 200 }, (_, i) => `\`step ${i}\` [note ${i}]`).join(" ");
    const before = `\`\`\`ts\n${code}\n\`\`\`\n${spans} \`two\nlines\` <https://example.com/${release}> then ${release} and`;
    const after = before.replace(`then ${release}`, `then ${link}`);

    expect(linked(before, false)).toBe(after);
    expect(linked(`${before} \`teamrun send ${release} hi`, false)).toBe(`${after} \`teamrun send ${release} hi`);
    expect(linked(`${before} [the chat ${release} and`, false)).toBe(`${after} [the chat ${release} and`);
  });

  describe("against the earlier linking, which scanned every reply for code and links", () => {
    const earlierLiteralsOf = (text: string, isWhole: boolean): readonly (readonly [number, number])[] => {
      const literals: [number, number][] = [];
      let fence: string | null = null;
      let start = 0;
      const masked = text.split(Resources.lineSeparator).map(line => {
        const opening = Resources.markdownFencePattern.exec(line)?.[1] ?? null;
        const isCode = !Object.isNull(fence) || !Object.isNull(opening) || Resources.markdownIndentedCodePattern.test(line);
        const closes = !Object.isNull(fence) && !Object.isNull(opening) && opening[0] === fence[0] && opening.length >= fence.length && line.trim() === opening;
        fence = Object.isNull(fence) ? opening : closes ? null : fence;
        const from = start;
        start += line.length + Resources.lineSeparator.length;
        if (!isCode)
          return line;
        literals.push([from, from + line.length]);
        return " ".repeat(line.length);
      }).join(Resources.lineSeparator);
      for (const match of masked.matchAll(Resources.markdownLiteralPattern))
        literals.push([match.index, match.index + match[0].length]);
      if (isWhole)
        return literals;
      const closed = literals.reduce((t, [from, to]) => t.slice(0, from) + " ".repeat(to - from) + t.slice(to), masked);
      const open = Resources.markdownOpenLiteralPattern.exec(closed);
      if (!Object.isNull(open))
        literals.push([open.index, text.length]);
      return literals;
    };
    const earlierLinked = (text: string, isWhole: boolean): string => {
      const literals = earlierLiteralsOf(text, isWhole);
      return text.replace(Resources.chatIdPattern, (id: string, offset: number) => {
        const end = offset + id.length;
        const chatId = id.toLowerCase();
        const title = titleOf(chatId);
        return Object.isNull(title) || (!isWhole && end === text.length) || literals.some(([from, to]) => offset < to && end > from) ? id
          : `[${title.replace(Resources.markdownPunctuationPattern, Resources.markdownPunctuationEscape)}](${Resources.chatLinkPrefix}${chatId})`;
      });
    };
    const pieces = [release, release.toUpperCase(), other, "0192e4f0-7c1a-7b2e-9d3f-111111111111", "`", "``", "```", "\n```ts\n", "\n~~~\n",
      "\n    ", "\n\t", "[", "]", "](", ")", "<", ">", "https://example.com/", "www.", "!", " ", " ", "\n", "word", "/", "."];
    const textOf = (seed: number): string => {
      let state = seed;
      return Array.from({ length: 1 + seed % 40 }, () => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0;
        return pieces[(state >>> 16) % pieces.length];
      }).join("");
    };
    const texts = Array.from({ length: 2000 }, (_, i) => textOf(i + 1));

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("links the same ids as the earlier linking in whole and streaming replies of mixed Markdown", () => {
      const differ = texts.flatMap(text => [true, false].filter(isWhole => linked(text, isWhole) !== earlierLinked(text, isWhole)).map(isWhole => [text, isWhole]));

      expect(differ).toEqual([]);
      expect(texts.filter(t => linked(t) !== t).length).toBeGreaterThan(texts.length / 40);
    });

    it("links the same ids as the earlier linking at every point of a streaming reply", () => {
      const streamed = texts.slice(0, 200).flatMap(text => Array.from({ length: text.length }, (_, i) => text.slice(0, i + 1)));

      expect(streamed.filter(t => linked(t, false) !== earlierLinked(t, false))).toEqual([]);
    });

    it("scans a reply for code and links only once it has a known chat's id, and once however many it has", () => {
      const fences = vi.spyOn(Resources.markdownFencePattern, "exec");
      const code = `\`\`\`\n${other}\n\`\`\`\nRun \`x\` and [note] then ${other} and`;

      expect([linked(code), linked(code, false), linked(`From ${release}`, false)]).toEqual([code, code, `From ${release}`]);
      expect(fences).not.toHaveBeenCalled();
      expect(linked(`${code} ${release}, ${release}.`)).toBe(`${code} ${link}, ${link}.`);
      expect(fences).toHaveBeenCalledTimes(code.split(Resources.lineSeparator).length);
    });
  });
});
