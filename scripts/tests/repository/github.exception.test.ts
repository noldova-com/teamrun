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

class GitHubExceptionTests {
  public static register(): void {
    test("the exception names itself and keeps its message and cause", () => {
      const cause = new Error("gh failed");
      const exception = new GitHubException("could not read", { cause });

      assert.equal(exception.name, "GitHubException");
      assert.equal(exception.message, "could not read");
      assert.equal(exception.cause, cause);
      assert.equal(exception.status, null);
      assert.ok(exception instanceof Error);
    });

    test("the exception keeps the HTTP status GitHub answered with", () => {
      assert.equal(new GitHubException("conflict", undefined, 409).status, 409);
    });
  }
}

GitHubExceptionTests.register();
