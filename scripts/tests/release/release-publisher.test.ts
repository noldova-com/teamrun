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
import type ReleaseFile from "../../release/release-file.ts";
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
  private static readonly RETRY_PAUSE: number = 10_000;
  private static readonly TICK: number = 1_000;
  private static readonly MAXIMUM_TURNS: number = 20_000;
  private static readonly QUIET_TURNS: number = 100;
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
      assert.deepEqual(github.writes, ["POST /releases", ...release.names.map(t => `UPLOAD ${t}`), "POST /git/refs", "PATCH /releases/1"]);
      assert.deepEqual(github.fields, ["tag_name=v0.0.2", `target_commitish=${ReleasePublisherTests.REVISION}`, "name=0.0.2", "body=Notes.", "draft=true",
        "ref=refs/tags/v0.0.2", `sha=${ReleasePublisherTests.REVISION}`, "make_latest=true", "draft=false"]);
      assert.equal(output.text, `Creating the draft release v0.0.2 for ${ReleasePublisherTests.REVISION}.\nPublished v0.0.2 from ${ReleasePublisherTests.REVISION} with 22 files.\n`);
    });

    test("publishing again changes nothing, and a published release whose tag or files differ fails without a change", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const files = await release.files.verifyAsync(release.folder, "0.0.2");
      const uploaded = files.map((t): readonly [string, string, number] => [t.name, `sha256:${t.digest.sha256}`, t.digest.size]);
      const [first] = release.names;
      const github = new ReleaseGitHubFixture();
      const moved = new ReleaseGitHubFixture();
      const extra = new ReleaseGitHubFixture();
      const short = new ReleaseGitHubFixture();
      github.addRelease("v0.0.2", ReleasePublisherTests.REVISION, false, uploaded);
      moved.addRelease("v0.0.2", ReleasePublisherTests.REVISION, false, uploaded);
      moved.tags.set("v0.0.2", ReleasePublisherTests.OTHER_REVISION);
      extra.addRelease("v0.0.2", ReleasePublisherTests.REVISION, false, [...uploaded, ["notes.txt", "sha256:00", 3]]);
      short.addRelease("v0.0.2", ReleasePublisherTests.REVISION, false, uploaded.slice(1));
      const output = new TextOutputFixture();

      await ReleasePublisherTests.publishAsync(t, github, release, output);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, moved, release, new TextOutputFixture()),
        new ReleaseException(`The tag v0.0.2 points at ${ReleasePublisherTests.OTHER_REVISION}, not at ${ReleasePublisherTests.REVISION}.`));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, extra, release, new TextOutputFixture()),
        new ReleaseException("v0.0.2 on GitHub differs from the built files. Missing: none. Not part of the release: notes.txt."));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, short, release, new TextOutputFixture()),
        new ReleaseException(`v0.0.2 on GitHub differs from the built files. Missing: ${String(first)}. Not part of the release: none.`));

      assert.equal(output.text, "v0.0.2 is already published with every file as built; nothing changed.\n");
      assert.deepEqual([github, moved, extra, short].map(t => t.writes), [[], [], [], []]);
    });

    test("a retry reuses the draft, keeps the files already uploaded, replaces an incomplete one and uploads the rest", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const [first, second, third] = release.names;
      github.upload(String(third), ["is refused"]);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture()),
        (error: unknown) => error instanceof GitHubException && error.status === 422);
      const [draft] = github.releases;
      const digest = await PackageDigest.readAsync(release.locate(String(second)));
      const incomplete = github.leaveIncomplete(String(second));
      const output = new TextOutputFixture();
      github.requests.length = 0;

      await ReleasePublisherTests.publishAsync(t, github, release, output);

      assert.deepEqual(github.writes.slice(0, 3), [`DELETE /releases/assets/${incomplete}`, `UPLOAD ${String(second)}`, `UPLOAD ${String(third)}`]);
      assert.equal(github.writes.includes(`UPLOAD ${String(first)}`), false);
      assert.deepEqual([github.releases.length, draft?.isDraft], [1, false]);
      assert.equal(draft?.assets.find(t => t.name === second)?.digest, `sha256:${digest.sha256}`);
      assert.ok(output.text.startsWith(`Deleting the incomplete upload of ${String(second)}.\n`), output.text);
    });

    test("a failed upload is retried no sooner than 10 s later", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const output = new TextOutputFixture();
      const [first] = release.names;
      github.upload(String(first), ["fails"]);
      const uploads = (): number => github.requests.filter(t => t === `UPLOAD ${String(first)}`).length;
      const files = await release.files.verifyAsync(release.folder, "0.0.2");
      t.mock.timers.enable({ apis: ["setTimeout"] });
      t.after(() => t.mock.timers.reset());

      const run = ReleasePublisherTests.startAsync(github, release, output, files);
      await ReleasePublisherTests.settleAsync(() => output.text.includes(" failed on attempt 1 of 3: "), "the first failed upload");
      t.mock.timers.tick(ReleasePublisherTests.RETRY_PAUSE - 1);
      for (let turn = 0; turn < ReleasePublisherTests.QUIET_TURNS; turn++)
        await ReleasePublisherTests.turnAsync();
      const early = uploads();
      t.mock.timers.tick(1);
      await ReleasePublisherTests.settleAsync(() => uploads() === 2, "the second upload once the pause ended");
      await ReleasePublisherTests.settleAsync(() => github.writes.includes("PATCH /releases/1"), "the publication");
      await run;

      assert.equal(early, 1);
      assert.equal(github.releases[0]?.isDraft, false);
    });

    test("failed and timed-out uploads are retried up to three attempts, and an incomplete file left by one is deleted first", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const exhausted = new ReleaseGitHubFixture();
      const [first, second, third] = release.names;
      github.upload(String(first), ["fails", "leaves an incomplete file", "uploads"]);
      github.upload(String(second), ["fails without a status"]);
      github.upload(String(third), ["times out"]);
      exhausted.upload(String(first), ["fails", "times out", "leaves an incomplete file"]);
      const output = new TextOutputFixture();

      await ReleasePublisherTests.publishAsync(t, github, release, output);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, exhausted, release, new TextOutputFixture()),
        new ReleaseException(`${String(first)} is still not uploaded after 3 attempts.`));

      assert.deepEqual(github.writes.slice(0, 8), ["POST /releases", `UPLOAD ${String(first)}`, `UPLOAD ${String(first)}`, "DELETE /releases/assets/2", `UPLOAD ${String(first)}`,
        `UPLOAD ${String(second)}`, `UPLOAD ${String(second)}`, `UPLOAD ${String(third)}`]);
      assert.ok(output.text.includes(`\nUploading ${String(first)} failed on attempt 1 of 3: "gh release upload v0.0.2 ${release.locate(String(first))} --repo ${ReleaseGitHubFixture.REPOSITORY}" `
        + "failed with exit code 1: HTTP 502: Bad Gateway (https://uploads.github.com/)\n"), output.text);
      assert.ok(output.text.includes(`\nUploading ${String(second)} failed on attempt 1 of 3: `), output.text);
      assert.ok(output.text.includes(`\nUploading ${String(third)} failed on attempt 1 of 3: "gh" did not finish within 900000 ms.\n`), output.text);
      assert.equal(github.releases[0]?.isDraft, false);
      assert.deepEqual(exhausted.writes, ["POST /releases", ...[1, 2, 3].map(() => `UPLOAD ${String(first)}`), "DELETE /releases/assets/2"]);
      assert.equal(exhausted.releases[0]?.isDraft, true);
    });

    test("an upload whose gh does not start is not retried", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const [first] = release.names;
      github.upload(String(first), ["does not start"]);

      await assert.rejects(ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture()), new ProcessException("\"gh\" could not start."));

      assert.deepEqual(github.writes, ["POST /releases", `UPLOAD ${String(first)}`]);
      assert.equal(github.releases[0]?.isDraft, true);
    });

    test("an upload that is refused or changes the file stops publication and leaves the release a draft", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const refusing = new ReleaseGitHubFixture();
      const changing = new ReleaseGitHubFixture();
      const [first] = release.names;
      refusing.upload(String(first), ["is refused"]);
      changing.upload(String(first), ["changes the file"]);
      const digest = await PackageDigest.readAsync(release.locate(String(first)));
      const changed = createHash("sha256").update("changed").digest("hex");

      await assert.rejects(ReleasePublisherTests.publishAsync(t, refusing, release, new TextOutputFixture()), (error: unknown) => error instanceof GitHubException && error.status === 422);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, changing, release, new TextOutputFixture()), new ReleaseException(
        `${String(first)} on GitHub has ${digest.size} bytes and sha256:${changed}, but the built file has ${digest.size} bytes and sha256:${digest.sha256}. A release's files are never replaced.`));
      assert.deepEqual([refusing, changing].map(t => t.releases.map(u => u.isDraft)), [[true], [true]]);
    });

    test("an uploaded file that differs or has no digest, another revision's draft or two releases with the tag stop publication", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const [first] = release.names;
      const digest = await PackageDigest.readAsync(release.locate(String(first)));
      const differing = new ReleaseGitHubFixture();
      const undigested = new ReleaseGitHubFixture();
      const other = new ReleaseGitHubFixture();
      const twice = new ReleaseGitHubFixture();
      differing.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true, [[String(first), "sha256:00", digest.size]]);
      undigested.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true, [[String(first), null, digest.size]]);
      other.addRelease("v0.0.2", ReleasePublisherTests.OTHER_REVISION, true);
      twice.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true);
      twice.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true);
      const built = `the built file has ${digest.size} bytes and sha256:${digest.sha256}. A release's files are never replaced.`;

      await assert.rejects(ReleasePublisherTests.publishAsync(t, differing, release, new TextOutputFixture()),
        new ReleaseException(`${String(first)} on GitHub has ${digest.size} bytes and sha256:00, but ${built}`));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, undigested, release, new TextOutputFixture()),
        new ReleaseException(`${String(first)} on GitHub has ${digest.size} bytes and no digest, but ${built}`));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, other, release, new TextOutputFixture()), new ReleaseException(
        `The draft release v0.0.2 is for ${ReleasePublisherTests.OTHER_REVISION}, not for ${ReleasePublisherTests.REVISION}; delete the draft by hand to publish ${ReleasePublisherTests.REVISION}.`));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, twice, release, new TextOutputFixture()),
        new ReleaseException("2 releases use the tag v0.0.2; delete all but one by hand before publishing."));
      assert.deepEqual([differing, undigested, other, twice].map(t => t.writes), [[], [], [], []]);
    });

    test("a tag on another commit, found before the draft, during the uploads or when the tag is created, stops publication and leaves the draft unpublished", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const tagged = new ReleaseGitHubFixture();
      const continued = new ReleaseGitHubFixture();
      const racing = new ReleaseGitHubFixture();
      const created = new ReleaseGitHubFixture();
      tagged.tags.set("v0.0.2", ReleasePublisherTests.OTHER_REVISION);
      continued.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true);
      continued.tags.set("v0.0.2", ReleasePublisherTests.OTHER_REVISION);
      racing.tagOnUpload = ReleasePublisherTests.OTHER_REVISION;
      created.tagOnCreate = ReleasePublisherTests.OTHER_REVISION;
      const reason = `The tag v0.0.2 appeared on ${ReleasePublisherTests.OTHER_REVISION}, not on ${ReleasePublisherTests.REVISION}, so the draft stays unpublished.`;

      await assert.rejects(ReleasePublisherTests.publishAsync(t, tagged, release, new TextOutputFixture()),
        new ReleaseException(`The tag v0.0.2 already exists, on ${ReleasePublisherTests.OTHER_REVISION}, without a release; a published tag is never moved.`));
      for (const github of [continued, racing, created])
        await assert.rejects(ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture()), new ReleaseException(reason));

      assert.deepEqual(tagged.writes, []);
      assert.deepEqual([continued, racing, created].map(t => [t.writes.some(u => u.startsWith("PATCH ")), t.releases.map(u => u.isDraft), t.tags.get("v0.0.2")]),
        [continued, racing, created].map(() => [false, [true], ReleasePublisherTests.OTHER_REVISION]));
    });

    test("a continued draft whose tag is already on the revision is published with that tag unchanged", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      github.addRelease("v0.0.2", ReleasePublisherTests.REVISION, true);
      github.tags.set("v0.0.2", ReleasePublisherTests.REVISION);

      await ReleasePublisherTests.publishAsync(t, github, release, new TextOutputFixture());

      assert.deepEqual(github.writes.filter(t => !t.startsWith("UPLOAD ")), ["POST /git/refs", "PATCH /releases/1"]);
      assert.deepEqual([github.releases[0]?.isDraft, github.tags.get("v0.0.2")], [false, ReleasePublisherTests.REVISION]);
    });

    test("a tag that cannot be created for another reason stops publication with GitHub's answer", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const invalid = new ReleaseGitHubFixture();
      const failing = new ReleaseGitHubFixture();
      invalid.referenceFailure = "gh: Validation Failed (HTTP 422)";
      failing.referenceFailure = "gh: Server Error (HTTP 500)";

      await assert.rejects(ReleasePublisherTests.publishAsync(t, invalid, release, new TextOutputFixture()), (error: unknown) => error instanceof GitHubException && error.status === 422);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, failing, release, new TextOutputFixture()), (error: unknown) => error instanceof GitHubException && error.status === 500);

      assert.deepEqual([invalid, failing].map(t => [t.writes.some(u => u.startsWith("PATCH ")), t.releases.map(u => u.isDraft), t.tags.has("v0.0.2")]), [[false, [true], false], [false, [true], false]]);
    });

    test("an annotated tag, a tag that cannot be read, a release GitHub keeps as a draft, a tag removed or a file added while publishing stops publication", { timeout: ReleasePublisherTests.TIMEOUT }, async t => {
      const release = await ReleasePublisherTests.createAsync(t);
      const annotated = new ReleaseGitHubFixture();
      const unreadable = new ReleaseGitHubFixture();
      const kept = new ReleaseGitHubFixture();
      const untagged = new ReleaseGitHubFixture();
      const added = new ReleaseGitHubFixture();
      annotated.tags.set("v0.0.2", ReleasePublisherTests.REVISION);
      annotated.tagType = "tag";
      unreadable.isTagReadFailing = true;
      kept.isPublishingIgnored = true;
      untagged.isTagDeletedOnPublish = true;
      added.assetOnPublish = "notes.txt";

      await assert.rejects(ReleasePublisherTests.publishAsync(t, annotated, release, new TextOutputFixture()),
        new ReleaseException("The tag v0.0.2 is annotated; a release's tag points straight at its commit."));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, unreadable, release, new TextOutputFixture()), (error: unknown) => error instanceof GitHubException && error.status === 500);
      await assert.rejects(ReleasePublisherTests.publishAsync(t, kept, release, new TextOutputFixture()), new ReleaseException("GitHub kept v0.0.2 as a draft when it was published."));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, untagged, release, new TextOutputFixture()),
        new ReleaseException(`The tag v0.0.2 points at nothing, not at ${ReleasePublisherTests.REVISION}.`));
      await assert.rejects(ReleasePublisherTests.publishAsync(t, added, release, new TextOutputFixture()),
        new ReleaseException("v0.0.2 on GitHub differs from the built files. Missing: none. Not part of the release: notes.txt."));
      assert.deepEqual([annotated, unreadable].map(t => t.writes), [[], []]);
    });
  }

  private static async createAsync(t: TestContext): Promise<ReleaseFolderFixture> {
    const release = await ReleaseFolderFixture.createAsync();
    t.after(() => release.disposeAsync());
    return release;
  }

  private static startAsync(github: ReleaseGitHubFixture, release: ReleaseFolderFixture, output: TextOutputFixture, files: readonly ReleaseFile[]): Promise<void> {
    return new ReleasePublisher(new GitHubApi(ReleaseGitHubFixture.REPOSITORY, github, release.folder), output)
      .publishAsync(ReleaseVersion.parse("0.0.2", "version"), ReleasePublisherTests.REVISION, release.folder, files, "Notes.");
  }

  private static async turnAsync(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }

  private static async settleAsync(condition: () => boolean, subject: string): Promise<void> {
    for (let turn = 0; turn < ReleasePublisherTests.MAXIMUM_TURNS; turn++) {
      await ReleasePublisherTests.turnAsync();
      if (condition())
        return;
    }
    assert.fail(`The publisher never reached ${subject} within ${ReleasePublisherTests.MAXIMUM_TURNS} turns.`);
  }

  private static async publishAsync(t: TestContext, github: ReleaseGitHubFixture, release: ReleaseFolderFixture, output: TextOutputFixture): Promise<void> {
    const files = await release.files.verifyAsync(release.folder, "0.0.2");
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let isDone = false;
      const run = ReleasePublisherTests.startAsync(github, release, output, files);
      const finish = (): void => {
        isDone = true;
      };
      run.then(finish, finish);
      for (let turn = 0; !isDone; turn++) {
        if (turn === ReleasePublisherTests.MAXIMUM_TURNS)
          assert.fail(`Publishing did not settle within ${ReleasePublisherTests.MAXIMUM_TURNS} turns of ${ReleasePublisherTests.TICK} ms.`);
        await ReleasePublisherTests.turnAsync();
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
