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
import ReleaseRequest from "../../release/release-request.ts";

class ReleaseRequestTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";

  public static register(): void {
    test("the repository, the version and the revision are read from the environment", () => {
      const request = ReleaseRequest.read({ RELEASE_REPOSITORY: "noldova-com/teamrun-release-trial", RELEASE_VERSION: "0.0.2", RELEASE_REVISION: ReleaseRequestTests.REVISION });

      assert.deepEqual([request.repository, request.version.tag, request.revision], ["noldova-com/teamrun-release-trial", "v0.0.2", ReleaseRequestTests.REVISION]);
    });

    test("a missing or malformed repository, version or revision is refused with the variable's name", () => {
      const valid = { RELEASE_REPOSITORY: "noldova-com/teamrun", RELEASE_VERSION: "0.0.2", RELEASE_REVISION: ReleaseRequestTests.REVISION };

      assert.throws(() => ReleaseRequest.read({ ...valid, RELEASE_REPOSITORY: undefined }), new ReleaseException("RELEASE_REPOSITORY must name a repository as owner/name, not \"\"."));
      assert.throws(() => ReleaseRequest.read({ ...valid, RELEASE_REPOSITORY: "noldova-com/teamrun/x" }),
        new ReleaseException("RELEASE_REPOSITORY must name a repository as owner/name, not \"noldova-com/teamrun/x\"."));
      for (const name of ["noldova-com/..", "noldova-com/."])
        assert.throws(() => ReleaseRequest.read({ ...valid, RELEASE_REPOSITORY: name }), new ReleaseException(`RELEASE_REPOSITORY must name a repository as owner/name, not "${name}".`));
      assert.equal(ReleaseRequest.read({ ...valid, RELEASE_REPOSITORY: "noldova-com/.github" }).repository, "noldova-com/.github");
      assert.throws(() => ReleaseRequest.read({ ...valid, RELEASE_VERSION: undefined }), new ReleaseException("RELEASE_VERSION must be a plain version such as 0.0.2, not \"\"."));
      assert.throws(() => ReleaseRequest.read({ ...valid, RELEASE_REVISION: undefined }),
        new ReleaseException("RELEASE_REVISION must be a full commit SHA of 40 lowercase hexadecimal digits, not \"\"."));
      assert.throws(() => ReleaseRequest.read({ ...valid, RELEASE_REVISION: "0123456" }),
        new ReleaseException("RELEASE_REVISION must be a full commit SHA of 40 lowercase hexadecimal digits, not \"0123456\"."));
    });
  }
}

ReleaseRequestTests.register();
