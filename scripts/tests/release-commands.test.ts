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
      const variables = ["GITHUB_OUTPUT", "GITHUB_REPOSITORY", "RELEASE_REVISION", "RELEASE_TAG", "GH_TOKEN", "RELEASE_SIGNED_PLATFORMS"];
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
      assert.throws(() => new ValidateRelease().run(), /Signed platforms/);
      process.env["RELEASE_SIGNED_PLATFORMS"] = "[\"mac\"]";
      assert.throws(() => new ValidateRelease().run(), /start with v/);
      process.env["RELEASE_TAG"] = fixture.candidate.tag;
      new ValidateRelease().run();
      const outputs = await readFile(process.env["GITHUB_OUTPUT"], "utf8");
      assert.match(outputs, /version=1.2.3/);
      assert.match(outputs, /signed-platforms=\["mac"\]/);
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
      await assert.rejects(new PublishRelease().runAsync(), /signing does not match/);
      await rm("_build/release", { recursive: true });
      process.env["RELEASE_SIGNED_PLATFORMS"] = "[]";
      await assert.rejects(new PublishRelease().runAsync(), /publication token/);
      await rm("_build/release", { recursive: true });
      process.env["GH_TOKEN"] = "fixture-token";
      const github = new GitHubReleaseFixture(fixture.candidate);
      t.mock.method(globalThis, "fetch", github.request.bind(github));
      await new PublishRelease().runAsync();
      assert.equal(github.release?.["draft"], false);
      assert.equal(github.assets.length, 25);
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

    test("signing secrets reach only signed packaging for their platform, and the release declares its signed platforms once", async () => {
      const release = await readFile(".github/workflows/release.yml", "utf8");
      const packaging = await readFile(".github/workflows/package-target.yml", "utf8");
      const manual = await readFile(".github/workflows/package.yml", "utf8");
      const checks = await readFile(".github/workflows/build-and-test.yml", "utf8");
      for (const workflow of [release, manual, checks])
        assert.doesNotMatch(workflow, /secrets\.|environment:/);
      assert.equal((packaging.match(/environment:/g) ?? []).length, 1);
      assert.ok(packaging.includes("environment: ${{ inputs.signed && 'release' || '' }}"));
      assert.ok(packaging.includes("timeout-minutes: ${{ inputs.signed && 90 || 45 }}"));
      const secrets = [["mac", "MAC_CERTIFICATE"], ["mac", "MAC_CERTIFICATE_PASSWORD"], ["mac", "APPLE_API_KEY_P8"], ["mac", "APPLE_API_KEY_ID"],
        ["mac", "APPLE_API_ISSUER"], ["windows", "AZURE_TENANT_ID"], ["windows", "AZURE_CLIENT_ID"], ["windows", "AZURE_CLIENT_SECRET"]] as const;
      assert.equal((packaging.match(/secrets\./g) ?? []).length, secrets.length);
      for (const [platform, secret] of secrets)
        assert.ok(packaging.includes(`\${{ inputs.signed && inputs.platform == '${platform}' && secrets.${secret} || '' }}`), secret);
      assert.ok(manual.includes("signed: ${{ inputs.signed && matrix.platform != 'linux' }}"));
      assert.equal((release.match(/RELEASE_SIGNED_PLATFORMS: '/g) ?? []).length, 1);
      assert.ok(release.includes("RELEASE_SIGNED_PLATFORMS: ${{ needs.validate.outputs.signed-platforms }}"));
      assert.equal((release.match(/signed: /g) ?? []).length, 4);
      for (const platform of ["windows", "mac"])
        assert.equal(release.split(`signed: \${{ contains(fromJSON(needs.validate.outputs.signed-platforms), '${platform}') }}`).length - 1, 2);
      assert.doesNotMatch(checks, /secrets:/);
      assert.equal((manual.match(/secrets: inherit/g) ?? []).length, 1);
      assert.equal((release.match(/secrets: inherit/g) ?? []).length, 4);
      for (const platform of ["windows", "mac", "linux"])
        for (const architecture of ["x64", "arm64"]) {
          const start = release.indexOf(`\n  ${platform}-${architecture}:\n`);
          const job = release.slice(start, release.indexOf("\n\n", start));
          assert.equal(job.includes("\n    secrets: inherit"), platform !== "linux", `${platform}-${architecture}`);
        }
    });
  }
}

ReleaseCommandsTests.register();
