/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import SentenceBreaker from "../../documents/sentence-breaker.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class SentenceBreakerTests {
  private static readonly PREFIX: RegExp = /^(?:[ \t]*>[ \t]?)*[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?/;
  private static readonly MARKER: RegExp = /[^>\s]/g;

  public static register(): void {
    test("each sentence of a paragraph, list item or quote goes on its own line at the item's indentation", () => {
      SentenceBreakerTests.assertFormats([
        "One sentence. Another one? A third! Done.",
        "- An item. Its second sentence.",
        "  - A nested item. Its second sentence.",
        "10. An ordered item. Its second sentence.",
        "> A quote. Its second sentence.",
        "> - A quoted item. Its second sentence.",
        "  A continuation line. Its second sentence."
      ], [
        "One sentence.", "Another one?", "A third!", "Done.",
        "- An item.", "  Its second sentence.",
        "  - A nested item.", "    Its second sentence.",
        "10. An ordered item.", "    Its second sentence.",
        "> A quote.", "> Its second sentence.",
        "> - A quoted item.", ">   Its second sentence.",
        "  A continuation line.", "  Its second sentence."
      ]);
    });

    test("quotes, brackets and emphasis that close a sentence stay with it", () => {
      SentenceBreakerTests.assertFormats([
        "It said \"Stop.\" Then it stopped.",
        "See the table (below.) It lists them.",
        "**Note.** The rule applies. _Really._ Yes.",
        "Is it [the guide](docs/guide.md)? It is."
      ], [
        "It said \"Stop.\"", "Then it stopped.",
        "See the table (below.)", "It lists them.",
        "**Note.**", "The rule applies.", "_Really._", "Yes.",
        "Is it [the guide](docs/guide.md)?", "It is."
      ]);
    });

    test("a sentence may start with a digit, a code span, a link, emphasis, a quote or a bracket", () => {
      SentenceBreakerTests.assertFormats([
        "It ran. 12 files changed. `npm test` passes. [The guide](x.md) says so. *Always.* \"Quoted.\" (Aside.) _Done._"
      ], [
        "It ran.", "12 files changed.", "`npm test` passes.", "[The guide](x.md) says so.", "*Always.*", "\"Quoted.\"", "(Aside.)", "_Done._"
      ]);
    });

    test("abbreviations, numbers, lower-case words and a line ending with an abbreviation do not end a sentence", () => {
      const abbreviations = "Use a pin, e.g. TeamRun's own, or i.e. Node, or etc. Next, or vs. Other, or cf. Section, or No. 5 and (e.g. Windows).";
      const paths = "A path like docs/a.md or a host like example.com stays whole.";
      const lowerCase = "The run ends. and goes on in lower case.";
      const endingAbbreviation = "It lists apples, pears, plums, etc.";

      SentenceBreakerTests.assertFormats(
        [abbreviations, "It takes 1.5 s on Node 26.7.0 and v1.2.3. It works.", paths, lowerCase, endingAbbreviation],
        [abbreviations, "It takes 1.5 s on Node 26.7.0 and v1.2.3.", "It works.", paths, lowerCase, endingAbbreviation]);
    });

    test("code spans, link targets and HTML tags hold no sentence ends", () => {
      const unchanged = [
        "Run `a. B` and ``b. `C` d. E`` now.",
        "Read [it](docs/a.md \"A title. With two sentences\") now.",
        "Follow [it](https://example.com/a.(b). C) now.",
        "Open <a title=\"A. B\">this</a> now, and <https://example.com/A. B> too.",
        "Keep a `code span. That never closes"
      ];

      SentenceBreakerTests.assertFormats(unchanged, unchanged);
    });

    test("a sentence that would start a list item when it begins a line stays on its line", () => {
      const unchanged = ["The marker is *. * Marks an item.", "It counts to 1. 2. and on.", "Then 3. 4) Follows."];

      SentenceBreakerTests.assertFormats(unchanged, unchanged);
    });

    test("headings, tables, code blocks, comments, link definitions, HTML and front matter are left as they are", () => {
      const unchanged = [
        "---",
        "title: A. B",
        "---",
        "# A heading. With two sentences",
        "| A cell. Two sentences | B. C |",
        "````ts",
        "const a = 1. Two;",
        "```",
        "Still code. Two sentences.",
        "````",
        "  ~~~",
        "  Code in a list. Two sentences.",
        "  ~~~",
        "<!-- A comment. With two sentences",
        "that goes on. For two lines -->",
        "<!-- A one-line comment. Two sentences. --> After it. Two.",
        "[guide]: docs/guide.md \"A. B\"",
        "<div>An HTML block. Two sentences.</div>",
        "- # A heading in an item. Two sentences"
      ];

      SentenceBreakerTests.assertFormats([...unchanged, "Prose again. Two sentences."], [...unchanged, "Prose again.", "Two sentences."]);
    });

    test("a dashed line that does not open the document is no front matter", () => {
      SentenceBreakerTests.assertFormats(["Text.", "---", "After it. Two."], ["Text.", "---", "After it.", "Two."]);
    });

    test("the text of a setext heading is left as it is, while a dashed line after a blank line underlines nothing", () => {
      const unchanged = [
        "A heading. With two sentences",
        "===",
        "",
        "A longer heading. Over",
        "two lines. Here",
        "---",
        "",
        "> A quoted heading. Two sentences",
        "> ===",
        ""
      ];

      SentenceBreakerTests.assertFormats(
        [...unchanged, "Prose. Two.", "", "---", "After a rule. Two."],
        [...unchanged, "Prose.", "Two.", "", "---", "After a rule.", "Two."]);
    });

    test("indented code blocks are left as they are, while indented lines that continue a paragraph or a list item are prose", () => {
      const code = ["Text.", "", "    const a = 1. Two;", "", "    Still code. Two sentences.", "\tTab code. Two."];
      const quotedCode = ["> A quote.", ">", ">     Quoted code. Two."];

      SentenceBreakerTests.assertFormats(
        [...code, "Prose after code. Two.", "    Continues it. Not code.", "", "- An item. Two.", "", "    Its second paragraph. Two.", "", ...quotedCode],
        [...code, "Prose after code.", "Two.", "    Continues it.", "    Not code.", "", "- An item.", "  Two.", "", "    Its second paragraph.", "    Two.", "", ...quotedCode]);
    });

    test("the check finds exactly the lines the formatter changes", () => {
      const breaker = new SentenceBreaker();
      const text = "# Title\n\nOne. Two.\n\n- Item.\n- Item. Two.\n\n```\nA. B.\n```\n";

      assert.deepEqual(breaker.findCrowdedLines(text), [3, 6]);
      assert.deepEqual(breaker.findCrowdedLines(breaker.format(text)), []);
      assert.equal(breaker.format(breaker.format(text)), breaker.format(text));
    });

    test("formatting every document only turns spaces between sentences into line breaks", async () => {
      const root = SourceTreeFixture.root;
      const breaker = new SentenceBreaker();
      const documents = (await new RepositoryFiles(root, new Git(root, new ProcessRunner())).listAsync()).filter(t => t.endsWith(".md"));

      assert.ok(documents.length > 0);
      for (const document of documents) {
        const text = await readFile(path.join(root, document), "utf8");
        const formatted = breaker.format(text);
        SentenceBreakerTests.assertSoftBreaks(text, formatted, document);
        assert.equal(breaker.format(formatted), formatted, document);
      }
    });
  }

  private static assertFormats(lines: readonly string[], expected: readonly string[]): void {
    const breaker = new SentenceBreaker();
    const text = `${lines.join("\n")}\n`;
    const formatted = breaker.format(text);

    assert.deepEqual(formatted.split("\n"), [...expected, ""]);
    SentenceBreakerTests.assertSoftBreaks(text, formatted, "fixture");
    assert.equal(breaker.format(formatted), formatted);
    assert.deepEqual(breaker.findCrowdedLines(formatted), []);
  }

  private static assertSoftBreaks(original: string, formatted: string, name: string): void {
    const produced = formatted.split("\n");
    let index = 0;
    for (const line of original.split("\n")) {
      const continuation = (SentenceBreakerTests.PREFIX.exec(line)?.[0] ?? "").replace(SentenceBreakerTests.MARKER, " ");
      let joined = produced[index++];
      while (joined !== line && joined !== undefined && joined.length < line.length) {
        const next = produced[index++];
        assert.ok(next !== undefined && next.startsWith(continuation), `${name}: a broken line does not continue with ${JSON.stringify(continuation)}: ${JSON.stringify(next)}`);
        joined = `${joined} ${next.slice(continuation.length)}`;
      }
      assert.equal(joined, line, `${name}: the line breaks change more than spaces between sentences`);
    }
    assert.equal(index, produced.length, `${name}: the formatted text has extra lines`);
  }
}

SentenceBreakerTests.register();
