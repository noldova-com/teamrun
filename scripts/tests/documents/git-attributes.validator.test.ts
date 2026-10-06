/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitAttributesValidator from "../../documents/git-attributes.validator.ts";

class GitAttributesValidatorTests {
  public static register(): void {
    test("attributes that hold the LF rule among others pass", () => {
      const validator = new GitAttributesValidator();

      assert.deepEqual(validator.validate("*.png binary\n  * text=auto eol=lf  \n"), []);
      assert.equal(GitAttributesValidator.FILE, ".gitattributes");
    });

    test("missing attributes, or attributes without the LF rule, fail with the rule they need", () => {
      const validator = new GitAttributesValidator();

      assert.deepEqual(validator.validate(null), [".gitattributes: is missing; it holds \"* text=auto eol=lf\", which keeps every text file's line endings LF."]);
      assert.deepEqual(validator.validate("* text=auto\n# * text=auto eol=lf\n* text=auto eol=crlf\n"),
        [".gitattributes: lacks the line \"* text=auto eol=lf\", which keeps every text file's line endings LF."]);
    });
  }
}

GitAttributesValidatorTests.register();
