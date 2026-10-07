/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test, type TestContext } from "node:test";

import AppleSignatureCheck from "../../packaging/apple-signature-check.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class AppleSignatureCheckTests {
  private static readonly SUCCEEDED: ProcessResult = new ProcessResult(0, "", "");

  public static register(): void {
    test("an app that fails every requirement is reported with each one and the tools' output, and its disk image is still detached and the work folder removed", async t => {
      const folder = await AppleSignatureCheckTests.createFolderAsync(t);
      const image = path.join(folder, "Fixture Studio-macos-arm64.dmg");
      const runner = new ProcessRunnerFixture([], [
        AppleSignatureCheckTests.SUCCEEDED,
        new ProcessResult(0, "Authority=Developer ID Application: Fixture Works (FIXTURE123)\n", ""),
        new ProcessResult(0, "accepted\nsource=Notarized Developer ID\n", ""),
        AppleSignatureCheckTests.SUCCEEDED,
        AppleSignatureCheckTests.SUCCEEDED,
        new ProcessResult(1, "", "code object is not signed at all"),
        new ProcessResult(1, "", ""),
        new ProcessResult(3, "", "rejected"),
        new ProcessResult(65, "", "does not have a ticket stapled to it"),
        AppleSignatureCheckTests.SUCCEEDED
      ]);

      await assert.rejects(new AppleSignatureCheck(runner, path.join(folder, "check"), {}).verifyAsync([image], "Fixture Studio"),
        new PackagingException(`The app in ${image} lacks a valid signature, a Developer ID Application signature, notarization, a stapled ticket:`
          + "\ncode object is not signed at all\n\nrejected\ndoes not have a ticket stapled to it"));

      assert.deepEqual(runner.captured.slice(0, 4), [
        ["codesign", path.join(folder, "check"), "--verify", "--strict", "--verbose=2", image],
        ["codesign", path.join(folder, "check"), "--display", "--verbose=2", image],
        ["spctl", path.join(folder, "check"), "--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=2", image],
        ["xcrun", path.join(folder, "check"), "stapler", "validate", image]
      ]);
      assert.deepEqual(runner.captured.at(-1), ["hdiutil", path.join(folder, "check"), "detach", path.join(folder, "check", "0"), "-force"]);
      assert.equal(existsSync(path.join(folder, "check")), false);
    });

    test("a disk image whose own signature is not Developer ID Application, notarized and stapled fails before it is attached", async t => {
      const folder = await AppleSignatureCheckTests.createFolderAsync(t);
      const image = path.join(folder, "Fixture Studio-macos-arm64.dmg");
      const runner = new ProcessRunnerFixture([], [
        AppleSignatureCheckTests.SUCCEEDED,
        new ProcessResult(0, "Authority=Apple Development: Fixture Works (FIXTURE123)\n", ""),
        new ProcessResult(3, "", "source=Unnotarized Developer ID"),
        new ProcessResult(65, "", "does not have a ticket stapled to it")
      ]);

      await assert.rejects(new AppleSignatureCheck(runner, path.join(folder, "check"), {}).verifyAsync([image], "Fixture Studio"),
        new PackagingException(`The disk image ${image} lacks a Developer ID Application signature, notarization, a stapled ticket:`
          + "\n\nAuthority=Apple Development: Fixture Works (FIXTURE123)\nsource=Unnotarized Developer ID\ndoes not have a ticket stapled to it"));

      assert.equal(runner.captured.some(t => t[0] === "hdiutil"), false);
      assert.equal(existsSync(path.join(folder, "check")), false);
    });

    test("a valid signature that is not Developer ID Application, or one assessed without notarization, fails the check", async t => {
      const folder = await AppleSignatureCheckTests.createFolderAsync(t);
      const archive = path.join(folder, "Fixture Studio-macos-x64.zip");
      const details = "Authority=Apple Development: Fixture Works (FIXTURE123)\nAuthority=Developer ID Certification Authority\n";
      const runner = new ProcessRunnerFixture([], [
        AppleSignatureCheckTests.SUCCEEDED,
        new ProcessResult(0, "valid on disk", ""),
        new ProcessResult(0, details, ""),
        new ProcessResult(0, "accepted\nsource=Developer ID", ""),
        new ProcessResult(0, "The validate action worked!", "")
      ]);

      await assert.rejects(new AppleSignatureCheck(runner, path.join(folder, "check"), {}).verifyAsync([archive], "Fixture Studio"),
        new PackagingException(`The app in ${archive} lacks a Developer ID Application signature, notarization:\n`
          + `valid on disk\n${details.trim()}\naccepted\nsource=Developer ID\nThe validate action worked!`));

      assert.deepEqual(runner.captured[0], ["ditto", path.join(folder, "check"), "-x", "-k", archive, path.join(folder, "check", "0")]);
      assert.equal(existsSync(path.join(folder, "check")), false);
    });
  }

  private static async createFolderAsync(t: TestContext): Promise<string> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository.directory;
  }
}

AppleSignatureCheckTests.register();
