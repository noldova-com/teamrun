/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ApiDocComment from "../../api/api-doc-comment.ts";
import ApiException from "../../api/api.exception.ts";

class ApiDocCommentTests {
  public static register(): void {
    test("each @example's fenced code is read with its indentation, skipping other tags and code lines that look like tags", () => {
      const comment = new ApiDocComment([
        "/**",
        " * Reads a value.",
        " *",
        " * @param name The **field** name.",
        " * @example",
        " * ```ts",
        " * if (ready)",
        " *   read();",
        " * @example",
        " * ```",
        " * @returns The value.",
        " * @example",
        " * ```ts",
        " * // @ts-expect-error",
        " * read(1);",
        " * ```",
        " */"
      ].join("\r\n"));

      assert.deepEqual(comment.readExamples("read"), ["if (ready)\n  read();\n@example\n", "// @ts-expect-error\nread(1);\n"]);
    });

    test("a comment without examples has none", () => {
      assert.deepEqual(new ApiDocComment("/** Reads a value. */").readExamples("read"), []);
    });

    test("an @example must open a ts code block and close it", () => {
      assert.throws(() => new ApiDocComment("/**\n * @example\n * read();\n */").readExamples("read"),
        new ApiException("An @example of read must start with a ```ts code block on its next line."));
      assert.throws(() => new ApiDocComment("/**\n * @example\n */").readExamples("read"),
        new ApiException("An @example of read must start with a ```ts code block on its next line."));
      assert.throws(() => new ApiDocComment("/**\n * @example\n * ```ts\n * read();\n */").readExamples("read"),
        new ApiException("An @example of read has no closing ```."));
    });
  }
}

ApiDocCommentTests.register();
