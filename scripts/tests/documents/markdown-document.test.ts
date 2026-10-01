/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import MarkdownDocument from "../../documents/markdown-document.ts";

class MarkdownDocumentTests {
  public static register(): void {
    test("headings produce the anchors GitHub generates, numbering repeated ones", () => {
      const document = new MarkdownDocument("docs/guide.md", [
        "# TeamRun coding standards",
        "## 6. Verification scope",
        "### The wire contract ###",
        "## 10. Build, installation and updates",
        "## `npm test` and [the runner](runner.md)",
        "## AI-assisted changes",
        "## Résumé_notes: “quoted” & more!",
        "## Repeated",
        "## Repeated",
        "#",
        "   #### Indented heading",
        "#not-a-heading",
        "    ## Indented code is not a heading?"
      ].join("\n"));

      assert.deepEqual([...document.anchors], [
        "teamrun-coding-standards",
        "6-verification-scope",
        "the-wire-contract",
        "10-build-installation-and-updates",
        "npm-test-and-the-runner",
        "ai-assisted-changes",
        "résumé_notes-quoted--more",
        "repeated",
        "repeated-1",
        "",
        "indented-heading"
      ]);
      assert.equal(document.path, "docs/guide.md");
    });

    test("inline links, images and reference definitions are read with their line numbers", () => {
      const document = new MarkdownDocument("README.md", [
        "Read the [guide](docs/guide.md) and the [rules](docs/rules.md#scope \"Rules\").",
        "![Logo](assets/logo.png) and [a [nested] label](<docs/space name.md>)",
        "[reference]: https://example.com/page",
        "  [indented]: <other.md> \"Title\"",
        "Text with `[code](not-a-link.md)` and [empty]() and [mail](mailto:team@example.com)."
      ].join("\n"));

      assert.deepEqual(document.links.map(t => [t.line, t.target]), [
        [1, "docs/guide.md"],
        [1, "docs/rules.md#scope"],
        [2, "assets/logo.png"],
        [2, "docs/space name.md"],
        [3, "https://example.com/page"],
        [4, "other.md"],
        [5, "mailto:team@example.com"]
      ]);
    });

    test("fenced code and HTML comments hide headings and links but keep line numbers", () => {
      const document = new MarkdownDocument("README.md", [
        "```ts",
        "## Not a heading [link](inside-fence.md)",
        "````",
        "~~~",
        "```",
        "[still inside](tilde-fence.md)",
        "~~~~",
        "## Visible",
        "Before <!-- [hidden](hidden.md) --> after [shown](shown.md)",
        "<!-- start",
        "## Hidden heading",
        "end --> [after](after.md) <!-- again --> [last](last.md) <!--",
        "[hidden too](hidden-too.md)",
        "-->",
        "[final](final.md)"
      ].join("\n"));

      assert.deepEqual([...document.anchors], ["visible"]);
      assert.deepEqual(document.links.map(t => [t.line, t.target]), [
        [9, "shown.md"],
        [12, "after.md"],
        [12, "last.md"],
        [15, "final.md"]
      ]);
    });
  }
}

MarkdownDocumentTests.register();
