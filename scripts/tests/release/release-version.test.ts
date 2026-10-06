/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ReleaseException from "../../release/release.exception.ts";
import ReleaseVersion from "../../release/release-version.ts";

class ReleaseVersionTests {
  public static register(): void {
    test("a plain version is read with its tag, and a version with a suffix, a leading zero, a missing part or too many digits is refused", () => {
      const version = ReleaseVersion.parse("10.0.2", "RELEASE_VERSION");

      assert.deepEqual([version.text, version.tag], ["10.0.2", "v10.0.2"]);
      for (const text of ["", "0.2", "0.0.2-beta", "0.0.2+7", "01.0.2", "0.0.1234567890", " 0.0.2"])
        assert.throws(() => ReleaseVersion.parse(text, "RELEASE_VERSION"), new ReleaseException(`RELEASE_VERSION must be a plain version such as 0.0.2, not "${text}".`));
    });

    test("a tag is read without its v, and a tag without it is refused", () => {
      assert.equal(ReleaseVersion.parseTag("v0.0.3", "The tag").text, "0.0.3");
      assert.throws(() => ReleaseVersion.parseTag("0.0.3", "The tag"), new ReleaseException("The tag must be a tag such as v0.0.2, not \"0.0.3\"."));
      assert.throws(() => ReleaseVersion.parseTag("vnext", "The tag"), new ReleaseException("The tag must be a plain version such as 0.0.2, not \"next\"."));
    });

    test("a version is newer only when its first differing part is higher, compared as numbers", () => {
      const compare = (newer: string, older: string): boolean => ReleaseVersion.parse(newer, "newer").isNewerThan(ReleaseVersion.parse(older, "older"));

      assert.deepEqual([compare("1.0.0", "0.9.9"), compare("0.10.0", "0.9.0"), compare("0.0.10", "0.0.9")], [true, true, true]);
      assert.deepEqual([compare("0.0.2", "0.0.2"), compare("0.0.1", "0.0.2"), compare("0.1.0", "1.0.0"), compare("0.1.9", "0.2.0")], [false, false, false, false]);
    });
  }
}

ReleaseVersionTests.register();
