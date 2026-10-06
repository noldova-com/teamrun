/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ModulePackage from "../../packaging/module-package.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import TrustedSigningModule from "../../packaging/trusted-signing-module.ts";
import signWindowsFile from "../../packaging/windows-sign-hook.ts";
import ProcessResult from "../../processes/process-result.ts";
import ModuleGalleryFixture from "../fixtures/module-gallery.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class TrustedSigningModuleTests {
  private static readonly CREDENTIALS: Readonly<Record<string, string>> = {
    AZURE_TENANT_ID: "fixture-tenant",
    AZURE_CLIENT_ID: "fixture-client",
    AZURE_CLIENT_SECRET: "fixture-secret"
  };

  public static register(): void {
    test("the recorded module is TrustedSigning 0.5.8 from the PowerShell Gallery, pinned to the SHA-512 the gallery publishes for it", () => {
      assert.deepEqual(TrustedSigningModule.GALLERY_PACKAGE, new ModulePackage("https://www.powershellgallery.com/api/v2/package/TrustedSigning/0.5.8",
        "h3QX13+As/6i8v7rSUhgDWg033GklH5JiVLGFV0Rl3CipfT6/0XQPqEhI2uOogGTFkxiqXOTCeQc4zTSt2v6KQ=="));
    });

    test("signing needs every Azure credential, and passes only those and the module's folder on", () => {
      const folder = path.resolve("signing");
      const signing = new TrustedSigningModule(new ProcessRunnerFixture(), folder, { ...TrustedSigningModuleTests.CREDENTIALS, GH_TOKEN: "fixture-token" });
      const partial = new TrustedSigningModule(new ProcessRunnerFixture(), folder, { AZURE_CLIENT_ID: "fixture-client", AZURE_CLIENT_SECRET: "" });

      assert.deepEqual(signing.describeEnvironment(), { ...TrustedSigningModuleTests.CREDENTIALS, TEAMRUN_SIGNING_FOLDER: folder });
      assert.throws(() => partial.describeEnvironment(),
        new PackagingException("Signing Windows packages needs AZURE_TENANT_ID, AZURE_CLIENT_SECRET, the Azure service principal that signs with noldova-signing."));
    });

    test("the downloaded package is expanded and loaded into a fresh folder only when its SHA-512 is the recorded one, and its archive is removed after", async t => {
      const [repository, gallery] = await TrustedSigningModuleTests.createAsync(t);
      const folder = path.join(repository.directory, "signing", "module");
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, "stale.psm1"), "stale\n");
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);

      await new TrustedSigningModule(runner, folder, { PATH: "fixture-path" }).prepareAsync(gallery.package);

      const [command, directory, ...options] = runner.captured[0] ?? [];
      const script = Buffer.from(String(options.at(-1)), "base64").toString("utf16le");
      assert.deepEqual(gallery.requests, ["/package"]);
      assert.equal(command, "pwsh");
      assert.equal(directory, path.join(repository.directory, "signing"));
      assert.deepEqual(options.slice(0, -1), ["-NoProfile", "-NonInteractive", "-EncodedCommand"]);
      assert.deepEqual(runner.captureEnvironments, [{
        PATH: "fixture-path",
        TEAMRUN_SIGNING_FOLDER: folder,
        TEAMRUN_SIGNING_ARCHIVE: path.join(repository.directory, "signing", "TrustedSigning.0.5.8.zip")
      }]);
      assert.ok(script.includes("Microsoft.PowerShell.Archive\\Expand-Archive -LiteralPath $env:TEAMRUN_SIGNING_ARCHIVE -DestinationPath $env:TEAMRUN_SIGNING_FOLDER\n"));
      assert.ok(script.includes("if ($module.Version -ne [version]'0.5.8') { throw \"TrustedSigning $($module.Version) loaded instead of 0.5.8.\" }"));
      assert.deepEqual(await readdir(path.join(repository.directory, "signing")), ["module"]);
      assert.deepEqual(await readdir(folder), []);
    });

    test("a package whose SHA-512 differs is never written or expanded, and a download or an expansion that fails is reported", async t => {
      const [repository, gallery] = await TrustedSigningModuleTests.createAsync(t);
      const folder = path.join(repository.directory, "signing", "module");
      const runner = new ProcessRunnerFixture([], [new ProcessResult(1, "", "Expand-Archive broke")]);
      const signing = new TrustedSigningModule(runner, folder, {});
      const unreachable = new ModulePackage("http://127.0.0.1:1/package", gallery.package.sha512);

      await assert.rejects(signing.prepareAsync(gallery.withHash("recorded")), new PackagingException(
        `The TrustedSigning 0.5.8 package from ${gallery.package.url} has the SHA-512 ${gallery.package.sha512}, not the recorded recorded, so it was not expanded.`));
      const hashed = existsSync(path.join(repository.directory, "signing"));
      await assert.rejects(signing.prepareAsync(gallery.missing), new PackagingException(`The TrustedSigning package could not be downloaded from ${gallery.missing.url}: HTTP 404.`));
      await assert.rejects(signing.prepareAsync(unreachable), (error: unknown) =>
        error instanceof PackagingException && error.message.startsWith(`The TrustedSigning package could not be downloaded from ${unreachable.url}: `) && error.cause !== undefined);
      await assert.rejects(signing.prepareAsync(gallery.package), new PackagingException("pwsh failed expanding and loading the TrustedSigning module with exit code 1:\nExpand-Archive broke"));

      assert.equal(hashed, false);
      assert.deepEqual(await readdir(path.join(repository.directory, "signing")), ["module"]);
    });

    test("a file is signed by the prepared module with SHA-256 digests and an RFC 3161 timestamp, named through the environment, and a failure names the file", async t => {
      const [repository] = await TrustedSigningModuleTests.createAsync(t);
      const folder = path.join(repository.directory, "signing", "module");
      const file = path.join(repository.directory, "out", "Fixture Studio.exe");
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "", ""), new ProcessResult(5, "", "Invoke-TrustedSigning broke")]);
      const signing = TrustedSigningModule.fromEnvironment(runner, { ...TrustedSigningModuleTests.CREDENTIALS, TEAMRUN_SIGNING_FOLDER: folder });

      await signing.signAsync(file);
      await assert.rejects(signing.signAsync(file), new PackagingException(`pwsh failed signing ${file} with the TrustedSigning module with exit code 5:\nInvoke-TrustedSigning broke`));

      const script = Buffer.from(String(runner.captured[0]?.at(-1)), "base64").toString("utf16le");
      assert.equal(runner.captured[0]?.[1], path.dirname(file));
      assert.deepEqual(runner.captureEnvironments[0], { ...TrustedSigningModuleTests.CREDENTIALS, TEAMRUN_SIGNING_FOLDER: folder, TEAMRUN_SIGNING_FILE: file });
      assert.ok(script.includes("TrustedSigning\\Invoke-TrustedSigning -Endpoint 'https://wus3.codesigning.azure.net/' -CodeSigningAccountName 'noldova-signing' "
        + "-CertificateProfileName 'TeamRun' -FileDigest 'SHA256' -TimestampRfc3161 'http://timestamp.acs.microsoft.com' -TimestampDigest 'SHA256' -Files $env:TEAMRUN_SIGNING_FILE"));
    });

    test("a file name with a comma, which the module would split, and a missing or relative module folder are refused, also from electron-builder's hook", async () => {
      const runner = new ProcessRunnerFixture();
      const signing = TrustedSigningModule.fromEnvironment(runner, { TEAMRUN_SIGNING_FOLDER: path.resolve("signing") });

      await assert.rejects(signing.signAsync("a,b.exe"), new PackagingException("TrustedSigning takes a comma-separated list of files, so it cannot sign a,b.exe."));
      assert.throws(() => TrustedSigningModule.fromEnvironment(runner, { TEAMRUN_SIGNING_FOLDER: "signing" }),
        new PackagingException("TEAMRUN_SIGNING_FOLDER must name the folder that holds the prepared TrustedSigning module, not \"signing\"."));
      await assert.rejects(signWindowsFile({ path: "Fixture Studio.exe" }),
        new PackagingException("TEAMRUN_SIGNING_FOLDER must name the folder that holds the prepared TrustedSigning module, not \"\"."));
      assert.deepEqual(runner.captured, []);
    });
  }

  private static async createAsync(t: TestContext): Promise<[RepositoryFixture, ModuleGalleryFixture]> {
    const repository = await RepositoryFixture.createAsync();
    const gallery = await ModuleGalleryFixture.createAsync();
    t.after(() => Promise.all([repository.disposeAsync(), gallery.disposeAsync()]));
    return [repository, gallery];
  }
}

TrustedSigningModuleTests.register();
