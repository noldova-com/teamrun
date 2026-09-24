/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { mock, test } from "node:test";
import { fileURLToPath } from "node:url";

import PublishRelease from "../publish-release.ts";
import ValidateRelease from "../validate-release.ts";
import GitHubReleaseFixture from "./release/fixtures/github-release.fixture.ts";
import ReleaseScriptFixture from "./release/fixtures/release-script.fixture.ts";
import ReleaseFixture from "./release/fixtures/release.fixture.ts";

mock.module("../script.ts", { exports: { default: ReleaseScriptFixture } });
const { default: TestRelease } = await import("../test-release.ts");

class ReleaseCommandsTests {
  public static register(): void {
    test("the test entry point type-checks first, enforces complete coverage and propagates prerequisite failures", async () => {
      await new TestRelease().runAsync();
      assert.deepEqual(ReleaseScriptFixture.calls[0], ["--project", "scripts/tsconfig.json"]);
      assert.ok(ReleaseScriptFixture.calls[1]?.includes("--test-coverage-lines=100"));
      assert.ok(ReleaseScriptFixture.calls[1]?.includes("--test-coverage-branches=100"));
      assert.ok(ReleaseScriptFixture.calls[1]?.includes("--test-coverage-functions=100"));
      assert.ok(ReleaseScriptFixture.calls[1]?.includes("--test-coverage-include-all"));
      assert.ok(ReleaseScriptFixture.calls[1]?.includes("--test-coverage-exclude=scripts/tests/**"));
      assert.ok(ReleaseScriptFixture.calls[1]?.includes("scripts/tests/release/*.test.ts"));
      ReleaseScriptFixture.calls.length = 0;
      ReleaseScriptFixture.failCompilation = true;
      await assert.rejects(new TestRelease().runAsync(), /Compilation failed/);
      assert.equal(ReleaseScriptFixture.calls.length, 1);
      ReleaseScriptFixture.failCompilation = false;
      const preload = new URL("./release/fixtures/release-command.fixture.ts", import.meta.url).href;
      const command = fileURLToPath(new URL("../test-release.ts", import.meta.url));
      const child = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--import", preload, command], { encoding: "utf8", timeout: 10_000 });
      assert.equal(child.status, 0, child.stderr);
    });

    test("the validation and publication commands require their environment and publish only verified assets", async t => {
      const fixture = await ReleaseFixture.create();
      const originalDirectory = process.cwd();
      const variables = ["GITHUB_OUTPUT", "GITHUB_REPOSITORY", "RELEASE_REVISION", "RELEASE_TAG", "GH_TOKEN"];
      const saved = new Map(variables.map(t => [t, process.env[t]]));
      t.after(async () => {
        process.chdir(originalDirectory);
        for (const [key, value] of saved)
          if (value === undefined) delete process.env[key]; else process.env[key] = value;
        await fixture.close();
      });
      for (const variable of variables)
        delete process.env[variable];
      process.chdir(fixture.directory);
      assert.throws(() => new ValidateRelease().run({}), /GITHUB_OUTPUT/);
      process.env["GITHUB_OUTPUT"] = path.join(fixture.directory, "outputs");
      assert.throws(() => new ValidateRelease().run(), /start with v/);
      process.env["RELEASE_TAG"] = fixture.candidate.tag;
      new ValidateRelease().run();
      assert.match(await readFile(process.env["GITHUB_OUTPUT"], "utf8"), /version=1.2.3/);
      await assert.rejects(new PublishRelease().runAsync({}), /publication repository/);
      process.env["GITHUB_REPOSITORY"] = "noldova-com/teamrun";
      await assert.rejects(new PublishRelease().runAsync(), /validated revision/);
      process.env["RELEASE_REVISION"] = fixture.candidate.revision;
      delete process.env["RELEASE_TAG"];
      await assert.rejects(new PublishRelease().runAsync(), /start with v/);
      process.env["RELEASE_TAG"] = fixture.candidate.tag;
      await fixture.seed();
      await cp(fixture.input, "_build/release-input", { recursive: true });
      await mkdir(".github");
      await writeFile(".github/RELEASE-NOTES.md", "Fixture notes");
      await assert.rejects(new PublishRelease().runAsync(), /publication token/);
      await rm("_build/release", { recursive: true });
      process.env["GH_TOKEN"] = "fixture-token";
      const github = new GitHubReleaseFixture(fixture.candidate);
      t.mock.method(globalThis, "fetch", github.request.bind(github));
      await new PublishRelease().runAsync();
      assert.equal(github.release?.["draft"], false);
      assert.equal(github.assets.length, 28);
      const command = fileURLToPath(new URL("../publish-release.ts", import.meta.url));
      const child = spawnSync(process.execPath, [command], {
        cwd: fixture.directory, env: { ...process.env, GITHUB_REPOSITORY: "wrong", GH_TOKEN: "" }, encoding: "utf8", timeout: 10_000
      });
      assert.equal(child.status, 1);
      assert.match(child.stderr, /publication repository/);
      const validation = spawnSync(process.execPath, [fileURLToPath(new URL("../validate-release.ts", import.meta.url))], {
        cwd: fixture.directory, env: { ...process.env, GITHUB_OUTPUT: "" }, encoding: "utf8", timeout: 10_000
      });
      assert.equal(validation.status, 1);
      assert.match(validation.stderr, /GITHUB_OUTPUT/);
    });

    test("the release workflow keeps six exact build outputs and grants write access only to publication", async () => {
      const release = await readFile(".github/workflows/release.yml", "utf8");
      const packaging = await readFile(".github/workflows/package-target.yml", "utf8");
      const manual = await readFile(".github/workflows/package.yml", "utf8");
      assert.match(release, /tags: \['v\*'\]/);
      assert.match(release, /workflow_dispatch:/);
      assert.equal((release.match(/contents: write/g) ?? []).length, 1);
      assert.doesNotMatch(packaging + manual, /contents: write|GH_TOKEN|publish-release/);
      for (const platform of ["windows", "mac", "linux"])
        for (const architecture of ["x64", "arm64"])
          assert.ok(release.includes(`needs.${platform}-${architecture}.outputs.artifact-id`));
      assert.match(packaging, /artifact-id: \$\{\{ steps.installers.outputs.artifact-id }}/);
      assert.match(release, /digest-mismatch: error/);
      assert.match(release, /merge-multiple: false/);
      assert.doesNotMatch(release.slice(release.indexOf("Download the exact"), release.indexOf("Verify assets, resume")), /run_attempt|pattern:|name: package-/);
      for (const name of ["windows-2025", "windows-11-arm", "ubuntu-24.04", "ubuntu-24.04-arm", "macos-15-intel", "macos-15"])
        assert.ok(packaging.includes(name));
      assert.ok(packaging.includes("npm run test:ui"));
      assert.ok(packaging.includes("npm run test:release"));
      assert.ok(packaging.includes("retention-days: 7"));
    });
  }
}

ReleaseCommandsTests.register();
