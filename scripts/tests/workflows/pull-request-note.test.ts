/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PullRequestFinding from "../../workflows/pull-request-finding.ts";
import PullRequestNote from "../../workflows/pull-request-note.ts";

class PullRequestNoteTests {
  private static readonly HEAD: string = "0123456789abcdef0123456789abcdef01234567";

  public static register(): void {
    test("a composed note carries its finding's kind and the head commit in a hidden marker that parses back", () => {
      const finding = PullRequestFinding.conflict(new Date("2026-10-04T12:00:00Z"), "main");

      const body = PullRequestNote.compose(finding, PullRequestNoteTests.HEAD);
      const note = PullRequestNote.parse(41, body);

      assert.equal(body, `<!-- pull-request-watch:conflict:${PullRequestNoteTests.HEAD} -->\n**Pull request watch:** ${finding.text}`);
      assert.equal(note?.id, 41);
      assert.equal(note?.kind, "conflict");
      assert.equal(note?.head, PullRequestNoteTests.HEAD);
      assert.equal(note?.isCleared, false);
      assert.equal(note?.matches("conflict", PullRequestNoteTests.HEAD), true);
      assert.equal(note?.matches("failed", PullRequestNoteTests.HEAD), false);
      assert.equal(note?.matches("conflict", "f".repeat(40)), false);
    });

    test("a cleared note keeps its text, says it no longer applies and is read back as cleared", () => {
      const body = PullRequestNote.compose(PullRequestFinding.notMerging(new Date()), PullRequestNoteTests.HEAD);
      const note = PullRequestNote.parse(7, body);

      const cleared = PullRequestNote.parse(7, note?.clearedBody ?? "");

      assert.equal(note?.clearedBody, `${body}\n\n**Cleared:** this finding no longer applies.`);
      assert.equal(cleared?.isCleared, true);
      assert.equal(cleared?.kind, "not-merging");
      assert.equal(cleared?.head, PullRequestNoteTests.HEAD);
    });

    test("text that does not start with the marker is not a note", () => {
      for (const body of ["", "Looks good.", ` <!-- pull-request-watch:conflict:${PullRequestNoteTests.HEAD} -->`, "<!-- pull-request-watch:conflict:abc -->", "<!-- other:conflict:" + PullRequestNoteTests.HEAD + " -->"])
        assert.equal(PullRequestNote.parse(1, body), null, body);
    });
  }
}

PullRequestNoteTests.register();
