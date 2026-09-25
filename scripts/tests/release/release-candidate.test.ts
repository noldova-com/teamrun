/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ReleaseCandidate from "../../release/release-candidate.ts";
import ReleaseFixture from "./fixtures/release.fixture.ts";

class ReleaseCandidateTests {
  public static register(): void {
    test("validates tags, main ancestry, exact revisions and matching manifest versions", async t => {
      const fixture = await ReleaseFixture.create();
      t.after(() => fixture.close());
      const candidate = new ReleaseCandidate(fixture.candidate.tag, fixture.directory, fixture.candidate.revision);
      assert.equal(candidate.revision, fixture.git(["rev-parse", "HEAD"]));
      assert.equal(candidate.releaseDate, new Date(fixture.git(["show", "-s", "--format=%cI", "HEAD"])).toISOString());
      const output = path.join(fixture.directory, "outputs");
      candidate.writeOutputs(output);
      assert.equal(await readFile(output, "utf8"), `revision=${candidate.revision}\nversion=1.2.3\n`);
      assert.throws(() => new ReleaseCandidate("1.2.3", fixture.directory), /start with v/);
      assert.throws(() => new ReleaseCandidate("v1.2.4", fixture.directory));
      assert.throws(() => new ReleaseCandidate("v1.2.3-alpha.1", fixture.directory), /without a suffix/);
      assert.throws(() => new ReleaseCandidate(candidate.tag, fixture.directory, "b".repeat(40)), /changed/);
      const version = candidate.version.value;
      const validLock = { version, packages: { "": { version } } };
      for (const [manifest, lock] of [
        [null, validLock], [1, validLock], [{}, validLock], [{ version: "2.0.0" }, validLock],
        [{ version }, {}], [{ version }, { version }], [{ version }, { version, packages: null }],
        [{ version }, { version, packages: 1 }], [{ version }, { version, packages: {} }],
        [{ version }, { version, packages: { "": {} } }]
      ]) {
        await writeFile(path.join(fixture.directory, "package.json"), JSON.stringify(manifest));
        await writeFile(path.join(fixture.directory, "package-lock.json"), JSON.stringify(lock));
        fixture.git(["add", "."]);
        fixture.git(["commit", "-qm", "Invalid candidate"]);
        fixture.git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
        fixture.git(["tag", "-f", candidate.tag]);
        assert.throws(() => new ReleaseCandidate(candidate.tag, fixture.directory), /must match/);
      }
      fixture.git(["update-ref", "refs/remotes/origin/main", candidate.revision]);
      assert.throws(() => new ReleaseCandidate(candidate.tag, fixture.directory));
    });
  }
}

ReleaseCandidateTests.register();
