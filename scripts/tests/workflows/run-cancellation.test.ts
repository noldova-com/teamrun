/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import RunCancellation from "../../workflows/run-cancellation.ts";

class RunCancellationTests {
  private static readonly ONE_RUN: string = "1 run of **Build and test** was cancelled, because it tests a revision that has to be merged again. "
    + "Merge or rebase `trunk` into the branch, resolve the conflicts and push; the push starts a new run.";
  private static readonly TWO_RUNS: string = "2 runs of **Build and test** were cancelled, because they test a revision that has to be merged again. "
    + "Merge or rebase `trunk` into the branch, resolve the conflicts and push; the push starts a new run.";

  public static register(): void {
    test("a cancellation lists the conflicting files in a code block and says how many runs were cancelled", () => {
      const cancellation = new RunCancellation("trunk", ["a.ts", "docs/b.md"], 2);

      assert.equal(cancellation.kind, "cancelled");
      assert.equal(cancellation.text, `\`trunk\` moved, and this pull request now conflicts with it in these files:\n\n\`\`\`\na.ts\ndocs/b.md\n\`\`\`\n\n${RunCancellationTests.TWO_RUNS}`);
    });

    test("a cancellation without files, known or readable, names none", () => {
      const expected = `\`trunk\` moved, and this pull request now conflicts with it. ${RunCancellationTests.ONE_RUN}`;

      assert.equal(new RunCancellation("trunk", [], 1).text, expected);
      assert.equal(new RunCancellation("trunk", null, 1).text, expected);
    });

    test("a file name cannot end the code block, and control characters show as escapes", () => {
      const text = new RunCancellation("trunk", ["a```b.ts", "c`d.ts", "e\nf\u007f.ts"], 1).text;

      assert.equal(text, `\`trunk\` moved, and this pull request now conflicts with it in these files:\n\n\`\`\`\`\na\`\`\`b.ts\nc\`d.ts\ne\\x0af\\x7f.ts\n\`\`\`\`\n\n${RunCancellationTests.ONE_RUN}`);
    });

    test("the comment shows at most 20 files and shortens each name to 200 characters", () => {
      const files = Array.from({ length: 23 }, (_, index) => `${index}.ts`);
      files[0] = `${"x".repeat(250)}.ts`;

      const text = new RunCancellation("trunk", files, 2).text;

      const lines = text.split("\n");
      assert.equal(lines[3], `${"x".repeat(199)}…`);
      assert.equal(lines[22], "19.ts");
      assert.equal(lines[23], "```");
      assert.ok(text.endsWith(`\`\`\`\n\nAnd 3 more.\n\n${RunCancellationTests.TWO_RUNS}`));
      assert.equal(new RunCancellation("trunk", files.slice(0, 20), 2).text.includes("more."), false);
    });

    test("runs are counted as one run or as several", () => {
      assert.deepEqual([RunCancellation.countRuns(1), RunCancellation.countRuns(2)], ["1 run", "2 runs"]);
    });
  }
}

RunCancellationTests.register();
