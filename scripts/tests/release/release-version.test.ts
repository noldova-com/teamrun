/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ReleaseVersion from "../../release/release-version.ts";

class ReleaseVersionTests {
  public static register(): void {
    test("accepts numbered releases with numeric SemVer ordering and rejects suffixes", () => {
      const ordered = ["0.0.0", "0.0.1", "0.0.2", "0.0.10", "0.1.0", "1.0.0", "10.0.0"];
      for (const [firstIndex, first] of ordered.entries()) {
        const version = new ReleaseVersion(first);
        assert.equal(version.value, first);
        for (const [secondIndex, second] of ordered.entries())
          assert.equal(version.compare(new ReleaseVersion(second)), Math.sign(firstIndex - secondIndex));
      }
      for (const invalid of ["v1.2.3", "1.2", "01.2.3", "1.02.3", "1.2.03", "1.2.3-alpha", "1.2.3-alpha.1", "1.2.3-beta.1", "1.2.3-nightly.1", "1.2.3+build", "1.2.3\n"])
        assert.throws(() => new ReleaseVersion(invalid));
    });
  }
}

ReleaseVersionTests.register();
