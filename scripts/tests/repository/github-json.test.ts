/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitHubException from "../../repository/github.exception.ts";
import GitHubJson from "../../repository/github-json.ts";

class GitHubJsonTests {
  public static register(): void {
    test("objects, arrays and children are read, and anything else names what it should have been", () => {
      const source = GitHubJson.object({ child: { a: 1 }, none: null, list: [{ b: 2 }] }, "answer");

      assert.deepEqual(GitHubJson.child(source, "child", "answer"), { a: 1 });
      assert.equal(GitHubJson.nullableChild(source, "none", "answer"), null);
      assert.deepEqual(GitHubJson.nullableChild(source, "child", "answer"), { a: 1 });
      assert.deepEqual(GitHubJson.children(source, "list", "answer"), [{ b: 2 }]);
      assert.deepEqual(GitHubJson.array([1, 2], "answer"), [1, 2]);
      for (const value of [null, 1, "text", [], undefined])
        assert.throws(() => GitHubJson.object(value, "answer"), new GitHubException("answer must be an object."));
      assert.throws(() => GitHubJson.array({}, "answer"), new GitHubException("answer must be an array."));
      assert.throws(() => GitHubJson.child(source, "missing", "answer"), new GitHubException("answer.missing must be an object."));
      assert.throws(() => GitHubJson.children(source, "child", "answer"), new GitHubException("answer.child must be an array."));
      assert.throws(() => GitHubJson.children(GitHubJson.object({ list: [1] }, "x"), "list", "answer"), new GitHubException("answer.list[0] must be an object."));
    });

    test("text, numbers and flags are read, and a wrong type names the field", () => {
      const source = GitHubJson.object({ text: "a", none: null, number: 7, fraction: 1.5, flag: false }, "answer");

      assert.equal(GitHubJson.text(source, "text", "answer"), "a");
      assert.equal(GitHubJson.nullableText(source, "text", "answer"), "a");
      assert.equal(GitHubJson.nullableText(source, "none", "answer"), null);
      assert.equal(GitHubJson.number(source, "number", "answer"), 7);
      assert.equal(GitHubJson.flag(source, "flag", "answer"), false);
      assert.throws(() => GitHubJson.text(source, "number", "answer"), new GitHubException("answer.number must be text."));
      assert.throws(() => GitHubJson.nullableText(source, "missing", "answer"), new GitHubException("answer.missing must be text."));
      assert.throws(() => GitHubJson.number(source, "text", "answer"), new GitHubException("answer.text must be a whole number."));
      assert.throws(() => GitHubJson.number(source, "fraction", "answer"), new GitHubException("answer.fraction must be a whole number."));
      assert.throws(() => GitHubJson.flag(source, "text", "answer"), new GitHubException("answer.text must be true or false."));
    });

    test("dates are read from ISO text, and text that is not a date names the field", () => {
      const source = GitHubJson.object({ date: "2026-10-04T12:00:00Z", none: null, bad: "yesterday" }, "answer");

      assert.equal(GitHubJson.date(source, "date", "answer").toISOString(), "2026-10-04T12:00:00.000Z");
      assert.equal(GitHubJson.nullableDate(source, "date", "answer")?.toISOString(), "2026-10-04T12:00:00.000Z");
      assert.equal(GitHubJson.nullableDate(source, "none", "answer"), null);
      assert.throws(() => GitHubJson.date(source, "bad", "answer"), new GitHubException("answer.bad must be a date."));
      assert.throws(() => GitHubJson.date(source, "none", "answer"), new GitHubException("answer.none must be text."));
    });
  }
}

GitHubJsonTests.register();
