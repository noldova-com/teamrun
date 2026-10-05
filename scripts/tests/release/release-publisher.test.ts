/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test, type TestContext } from "node:test";

import ProcessException from "../../processes/process.exception.ts";
import PackageDigest from "../../release/package-digest.ts";
import ReleaseException from "../../release/release.exception.ts";
import ReleasePublisher from "../../release/release-publisher.ts";
import ReleaseVersion from "../../release/release-version.ts";
import GitHubApi from "../../repository/github-api.ts";
import GitHubException from "../../repository/github.exception.ts";
import ReleaseFolderFixture from "../fixtures/release-folder.fixture.ts";
import ReleaseGitHubFixture from "../fixtures/release-github.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ReleasePublisherTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly OTHER_REVISION: string = "fedcba9876543210fedcba9876543210fedcba98";
  private static readonly TICK: number = 1_000;
  private static readonly TIMEOUT: number = 30_000;

  public static register(): void {
    test("a release is created as a draft, every file is uploaded and checked, and only then is it published with its tag on the revision", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const output = new TextOutputFixture();

      await ReleasePublisherTests.publishAsync(t, github, release, output);

      const [published] = github.releases;
      assert.deepEqual([github.releases.length, published?.isDraft, published?.target, published?.assets.map(t => t.name)], [1, false, ReleasePublisherTests.REVISION, release.names]);
      assert.equal(github.tags.get("v0.0.2"), ReleasePublisherTests.REVISION);
      assert.deepEqual(github.writes, ["POST /releases", ...release.names.map(t => `UPLOAD ${t}`), "PATCH /releases/1"]);
      assert.deepEqual(github.fields, ["tag_name=v0.0.2", `target_commitish=${ReleasePublisherTests.REVISION}`, "name=0.0.2", "body=Notes.", "draft=true", "make_latest=true", "draft=false"]);
      assert.equal(output.text, `Creating the draft release v0.0.2 for ${ReleasePublisherTests.REVISION}.\nPublished v0.0.2 from ${ReleasePublisherTests.REVISION} with 22 files.\n`);
    });

    test("publishing again changes nothing, and a published release whose files or tag differ fails without a change", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      await ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture());
      const written = github.writes.length;
      const output = new TextOutputFixture();

      await ReleasePublisherTests.publishAsync(t, github, release, output);
      assert.equal(output.text, "v0.0.2 is already published with every file as built; nothing changed.\n");
      github.tags.set("v0.0.2", ReleasePublisherTests.OTHER_REVISION);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture()),
        new ReleaseException(`The tag v0.0.2 points at ${ReleasePublisherTests.OTHER_REVISION}, not at ${ReleasePublisherTests.REVISION}.`));
      const [published] = github.releases;
      published?.assets.pop();
      await assert.rejects(ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture()),
        new ReleaseException("v0.0.2 on GitHub differs from the built files. Missing: latest-linux-arm64.yml. Not part of the release: none."));
      assert.equal(github.writes.length, written);
    });

    test("a retry reuses the draft, keeps the files already uploaded, replaces an incomplete one and uploads the rest", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const [first, second, third] = release.names;
      github.upload(String(third), ["is refused"]);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture()),
        (error: unknown) => error instanceof GitHubException && error.status === 422);
      const draft = github.releases[0];
      const digest = await PackageDigest.readAsync(release.locate(String(second)));
      const incomplete = github.leaveIncomplete(String(second));
      const output = new TextOutputFixture();
      github.requests.length = 0;

      await ReleasePublisherTests.publishAsync(t, github, release, output);

      assert.deepEqual(github.writes.slice(0, 3), [`DELETE /releases/assets/${incomplete}`, `UPLOAD ${String(second)}`, `UPLOAD ${String(third)}`]);
      assert.equal(github.writes.includes(`UPLOAD ${String(first)}`), false);
      assert.equal(github.releases.length, 1);
      assert.equal(draft?.isDraft, false);
      assert.equal(draft?.assets.find(t => t.name === second)?.digest, `sha256:${digest.sha256}`);
      assert.ok(output.text.startsWith(`Deleting the incomplete upload of ${String(second)}.\n`), output.text);
    });

    test("a failed upload is retried after its pause until three attempts, and an incomplete file left by one is deleted first", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const exhausted = new ReleaseGitHubFixture();
      const [first, second] = release.names;
      github.upload(String(first), ["fails", "leaves an incomplete file", "uploads"]);
      github.upload(String(second), ["fails without a status"]);
      exhausted.upload(String(first), ["fails", "fails", "leaves an incomplete file"]);
      const output = new TextOutputFixture();
      const failing = new TextOutputFixture();

      await ReleasePublisherTests.publishAsync(t, github, release, output);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, exhausted, release, failing), new ReleaseException(`${String(first)} is still not uploaded after 3 attempts.`));

      assert.deepEqual(github.writes.slice(0, 6), ["POST /releases", `UPLOAD ${String(first)}`, `UPLOAD ${String(first)}`, "DELETE /releases/assets/2", `UPLOAD ${String(first)}`, `UPLOAD ${String(second)}`]);
      assert.ok(output.text.includes(`\nUploading ${String(first)} failed on attempt 1 of 3: "gh release upload v0.0.2 ${release.locate(String(first))} --repo ${ReleaseGitHubFixture.REPOSITORY}" `
        + "failed with exit code 1: HTTP 502: Bad Gateway (https://uploads.github.com/)\n"), output.text);
      assert.ok(output.text.includes(`\nUploading ${String(second)} failed on attempt 1 of 3: `), output.text);
      assert.equal(github.releases[0]?.isDraft, false);
      assert.deepEqual(exhausted.writes, ["POST /releases", ...[1, 2, 3].map(() => `UPLOAD ${String(first)}`), "DELETE /releases/assets/2"]);
      assert.equal(exhausted.releases[0]?.isDraft, true);
    });

    test("an upload that is refused, times out or changes the file stops publication and leaves the release a draft", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const runners = [new ReleaseGitHubFixture(), new ReleaseGitHubFixture()] as const;
      const [first] = release.names;
      runners[0].upload(String(first), ["times out"]);
      runners[1].upload(String(first), ["changes the file"]);
      const digest = await PackageDigest.readAsync(release.locate(String(first)));
      const changed = createHash("sha256").update("changed").digest("hex");

      await assert.rejects(ReleasePublisherTests.publishAsync(t, runners[0], release, new TextOutputFixture()), new ProcessException("\"gh\" did not finish within 900000 ms."));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, runners[1], release, new TextOutputFixture()), new ReleaseException(
        `${String(first)} on GitHub has ${digest.size} bytes and sha256:${changed}, but the built file has ${digest.size} bytes and sha256:${digest.sha256}. A release's files are never replaced.`));
      assert.deepEqual(runners.map(t => t.releases.map(u => u.isDraft)), [[true], [true]]);
    });

    test("an uploaded file that differs or has no digest, an unexpected file, another revision's draft or two releases with the tag stop publication",
      { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
        const release = await ReleasePublisherTests.createAsync(t);
        const [first] = release.names;
        const digest = await PackageDigest.readAsync(release.locate(String(first)));
        const differing = new ReleaseGitHubFixture();
        const undigested = new ReleaseGitHubFixture();
        const unexpected = new ReleaseGitHubFixture();
        const other = new ReleaseGitHubFixture();
        const twice = new ReleaseGitHubFixture();
        differing.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true, [[String(first), "sha256:00", digest.size]]);
        undigested.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true, [[String(first), null, digest.size]]);
        unexpected.addRelease("v0.0.2", ReleasePublisherTests.REVISION, false, [["notes.txt", "sha256:00", 3]]);
        other.addRelease("v0.0.2", ReleasePublisherTests.OTHER_REVISION, true);
        twice.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true);
        twice.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true);
        const built = `the built file has ${digest.size} bytes and sha256:${digest.sha256}. A release's files are never replaced.`;

        await assert.rejects(ReleasePublisherTests.publishAsync(t, differing, release, new TextOutputFixture()),
          new ReleaseException(`${String(first)} on GitHub has ${digest.size} bytes and sha256:00, but ${built}`));
        await assert.rejects(ReleasePublisherTests.publishAsync(t, undigested, release, new TextOutputFixture()),
          new ReleaseException(`${String(first)} on GitHub has ${digest.size} bytes and no digest, but ${built}`));
        await assert.rejects(ReleasePublisherTests.publishAsync(t, unexpected, release, new TextOutputFixture()), new ReleaseException(
          `v0.0.2 on GitHub differs from the built files. Missing: ${release.names.join(", ")}. Not part of the release: notes.txt.`));
        await assert.rejects(ReleasePublisherTests.publishAsync(t, other, release, new TextOutputFixture()), new ReleaseException(
          `The draft release v0.0.2 is for ${ReleasePublisherTests.OTHER_REVISION}, not for ${ReleasePublisherTests.REVISION}; delete the draft by hand to publish ${ReleasePublisherTests.REVISION}.`));
        await assert.rejects(ReleasePublisherTests.publishAsync(t, twice, release, new TextOutputFixture()),
          new ReleaseException("2 releases use the tag v0.0.2; delete all but one by hand before publishing."));
        assert.deepEqual([differing, undigested, unexpected, other, twice].map(t => t.writes), [[], [], [], [], []]);
      });

    test("a tag without a release, an annotated tag, a tag that cannot be read or a release GitHub keeps as a draft stops publication", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const tagged = new ReleaseGitHubFixture();
      const annotated = new ReleaseGitHubFixture();
      const unreadable = new ReleaseGitHubFixture();
      const kept = new ReleaseGitHubFixture();
      tagged.tags.set("v0.0.2", ReleasePublisherTests.OTHER_REVISION);
      annotated.tags.set("v0.0.2", ReleasePublisherTests.REVISION);
      annotated.tagType = "tag";
      unreadable.isTagReadFailing = true;
      kept.isPublishingIgnored = true;

      await assert.rejects(ReleasePublisherTests.publishAsync(t, tagged, release, new TextOutputFixture()),
        new ReleaseException(`The tag v0.0.2 already exists, on ${ReleasePublisherTests.OTHER_REVISION}, without a release; a published tag is never moved.`));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, annotated, release, new TextOutputFixture()),
        new ReleaseException("The tag v0.0.2 is annotated; a release's tag points straight at its commit."));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, unreadable, release, new TextOutputFixture()), (error: unknown) => error instanceof GitHubException && error.status === 500);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, kept, release, new TextOutputFixture()), new ReleaseException("GitHub kept v0.0.2 as a draft when it was published."));
      assert.deepEqual([tagged, annotated, unreadable].map(t => t.writes), [[], [], []]);
    });
  }

  private static async createAsync(t: TestContext): Promise<ReleaseFolderFixture> {
    const release = await ReleaseFolderFixture.createAsync();
    t.after(() => release.disposeAsync());
    return release;
  }

  private static async publishAsync(t: TestContext, github: ReleaseGitHubFixture, release: ReleaseFolderFixture, output: TextOutputFixture): Promise<void> {
    const publisher = new ReleasePublisher(new GitHubApi(ReleaseGitHubFixture.REPOSITORY, github, release.folder), output);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let isDone = false;
      const run = publisher.publishAsync(ReleaseVersion.parse("0.0.2", "version"), ReleasePublisherTests.REVISION, release.folder, release.names, "Notes.");
      const finish = (): void => {
        isDone = true;
      };
      run.then(finish, finish);
      while (!isDone) {
        await new Promise(resolve => setImmediate(resolve));
        t.mock.timers.tick(ReleasePublisherTests.TICK);
      }
      await run;
    }
    finally {
      t.mock.timers.reset();
    }
  }
}

ReleasePublisherTests.register();
