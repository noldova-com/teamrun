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
import { createRequire } from "node:module";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackagingException from "../../packaging/packaging.exception.ts";
import PinnedPackage from "../../packaging/pinned-package.ts";
import TrustedSigningModule from "../../packaging/trusted-signing-module.ts";
import signWindowsFile from "../../packaging/windows-sign-hook.ts";
import ProcessResult from "../../processes/process-result.ts";
import PackageGalleryFixture from "../fixtures/package-gallery.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class TrustedSigningModuleTests {
  private static readonly CREDENTIALS: Readonly<Record<string, string>> = {
    AZURE_TENANT_ID: "fixture-tenant",
    AZURE_CLIENT_ID: "fixture-client",
    AZURE_CLIENT_SECRET: "fixture-secret"
  };

  public static register(): void {
    test("the recorded packages are TrustedSigning 0.5.8 and the three NuGet packages it installs, each pinned to the SHA-512 its gallery publishes", () => {
      assert.deepEqual(TrustedSigningModule.PACKAGES, [
        new PinnedPackage("https://www.powershellgallery.com/api/v2/package/TrustedSigning/0.5.8",
          "h3QX13+As/6i8v7rSUhgDWg033GklH5JiVLGFV0Rl3CipfT6/0XQPqEhI2uOogGTFkxiqXOTCeQc4zTSt2v6KQ==", "module"),
        new PinnedPackage("https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/10.0.26100.4188/microsoft.windows.sdk.buildtools.10.0.26100.4188.nupkg",
          "OkiRhdDr0ngD6+wm0Ezdu1mgV8ZuknXdHwjzeHVZjYSXi9bCkYkq9Ns/X/ab9BoHb+Tq/5/RmXbdNWtC0qHipQ==",
          "tools/TrustedSigning/Microsoft.Windows.SDK.BuildTools/Microsoft.Windows.SDK.BuildTools.10.0.26100.4188"),
        new PinnedPackage("https://api.nuget.org/v3-flatcontainer/microsoft.trusted.signing.client/1.0.95/microsoft.trusted.signing.client.1.0.95.nupkg",
          "uTRnbWSg1agZUh8J5bqJXhJr4LZ9dzs6Xy9PNxK4yA9ubpGuPq71bz1AZMmiKs/HVbQc3NUChtGMVexqmuV+kA==",
          "tools/TrustedSigning/Microsoft.Trusted.Signing.Client/Microsoft.Trusted.Signing.Client.1.0.95"),
        new PinnedPackage("https://api.nuget.org/v3-flatcontainer/sign/0.9.1-beta.24469.1/sign.0.9.1-beta.24469.1.nupkg",
          "JftL2Fv9TwqfQdxh3Sjq/iqPb8lWEIMgDfa32KCXFqkebD1iadk10eRTjagVQgoxxRQiOp39eCd0ufs5cPD93A==",
          "tools/TrustedSigning/sign/sign.0.9.1-beta.24469.1")
      ]);
    });

    test("signing needs every Azure credential, and passes only those and the module's folder on", () => {
      const folder = path.resolve("signing");
      const signing = new TrustedSigningModule(new ProcessRunnerFixture(), folder, { GH_TOKEN: "fixture-token" });

      assert.deepEqual(signing.describeEnvironment({ ...TrustedSigningModuleTests.CREDENTIALS, MAC_CERTIFICATE: "fixture-certificate" }),
        { ...TrustedSigningModuleTests.CREDENTIALS, TEAMRUN_SIGNING_FOLDER: folder });
      assert.throws(() => signing.describeEnvironment({ AZURE_CLIENT_ID: "fixture-client", AZURE_CLIENT_SECRET: "" }),
        new PackagingException("Signing Windows packages needs AZURE_TENANT_ID, AZURE_CLIENT_SECRET, the Azure service principal that signs with noldova-signing."));
    });

    test("the downloaded packages are expanded into a fresh folder and the module loaded only when every SHA-512 is the recorded one, and their archives are removed after", async t => {
      const [repository, gallery] = await TrustedSigningModuleTests.createAsync(t);
      const folder = path.join(repository.directory, "signing");
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, "stale.psm1"), "stale\n");
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);

      await new TrustedSigningModule(runner, folder, { PATH: "fixture-path" }).prepareAsync(gallery.packages);

      const [command, directory, ...options] = runner.captured[0] ?? [];
      const script = Buffer.from(String(options.at(-1)), "base64").toString("utf16le");
      assert.deepEqual(gallery.requests, ["/module", "/tool"]);
      assert.equal(command, "pwsh");
      assert.equal(directory, folder);
      assert.deepEqual(options.slice(0, -1), ["-NoProfile", "-NonInteractive", "-EncodedCommand"]);
      assert.deepEqual(runner.captureEnvironments, [{
        PATH: "fixture-path",
        TEAMRUN_SIGNING_FOLDER: folder,
        TEAMRUN_SIGNING_ARCHIVES: [path.join(folder, "module.zip"), path.join(folder, "Fixture.Tool.1.0.0.zip")].join("\n"),
        TEAMRUN_SIGNING_DESTINATIONS: [path.join(folder, "module"), path.join(folder, "tools", "TrustedSigning", "Fixture.Tool", "Fixture.Tool.1.0.0")].join("\n")
      }]);
      assert.ok(script.includes("for ($index = 0; $index -lt $archives.Count; $index++) { "
        + "Microsoft.PowerShell.Archive\\Expand-Archive -LiteralPath $archives[$index] -DestinationPath $destinations[$index] }\n"));
      assert.ok(script.includes("Microsoft.PowerShell.Core\\Import-Module (Microsoft.PowerShell.Management\\Join-Path $env:TEAMRUN_SIGNING_FOLDER 'module' 'TrustedSigning.psd1')\n"));
      assert.ok(script.includes("if ($module.Version -ne [version]'0.5.8') { throw \"TrustedSigning $($module.Version) loaded instead of 0.5.8.\" }"));
      assert.deepEqual(await readdir(folder), []);
    });

    test("when any package's SHA-512 differs nothing is written or expanded, and a download or an expansion that fails is reported", async t => {
      const [repository, gallery] = await TrustedSigningModuleTests.createAsync(t);
      const folder = path.join(repository.directory, "signing");
      const runner = new ProcessRunnerFixture([], [new ProcessResult(1, "", "Expand-Archive broke")]);
      const signing = new TrustedSigningModule(runner, folder, {});
      const unreachable = new PinnedPackage("http://127.0.0.1:1/tool", gallery.tool.sha512, PackageGalleryFixture.TOOL_FOLDER);

      await assert.rejects(signing.prepareAsync(gallery.withToolHash("recorded")), new PackagingException(
        `The package from ${gallery.tool.url} has the SHA-512 ${gallery.tool.sha512}, not the recorded recorded, so no signing package was expanded.`));
      const hashed = existsSync(folder);
      await assert.rejects(signing.prepareAsync([gallery.module, gallery.missing]), new PackagingException(`A signing package could not be downloaded from ${gallery.missing.url}: HTTP 404.`));
      await assert.rejects(signing.prepareAsync([unreachable]), (error: unknown) =>
        error instanceof PackagingException && error.message.startsWith(`A signing package could not be downloaded from ${unreachable.url}: `) && error.cause !== undefined);
      await assert.rejects(signing.prepareAsync(gallery.packages), new PackagingException("pwsh failed expanding and loading the TrustedSigning module with exit code 1:\nExpand-Archive broke"));

      assert.equal(hashed, false);
      assert.deepEqual(gallery.requests, ["/module", "/tool", "/module", "/missing", "/module", "/tool"]);
      assert.deepEqual(await readdir(folder), []);
    });

    test("a file is signed by the prepared module and its pinned tools with SHA-256 digests and an RFC 3161 timestamp, named through the environment, and a failure names the file",
      async t => {
        const [repository] = await TrustedSigningModuleTests.createAsync(t);
        const folder = path.join(repository.directory, "signing");
        const file = path.join(repository.directory, "out", "Fixture Studio.exe");
        const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "", ""), new ProcessResult(5, "", "Invoke-TrustedSigning broke")]);
        const signing = TrustedSigningModule.fromEnvironment(runner, { ...TrustedSigningModuleTests.CREDENTIALS, LocalAppData: "fixture-local", TEAMRUN_SIGNING_FOLDER: folder });

        await signing.signAsync(file);
        await assert.rejects(signing.signAsync(file), new PackagingException(`pwsh failed signing ${file} with the TrustedSigning module with exit code 5:\nInvoke-TrustedSigning broke`));

        const script = Buffer.from(String(runner.captured[0]?.at(-1)), "base64").toString("utf16le");
        assert.equal(runner.captured[0]?.[1], path.dirname(file));
        assert.deepEqual(runner.captureEnvironments[0], {
          ...TrustedSigningModuleTests.CREDENTIALS,
          TEAMRUN_SIGNING_FOLDER: folder,
          TEAMRUN_SIGNING_FILE: file,
          LOCALAPPDATA: path.join(folder, "tools")
        });
        assert.ok(script.startsWith("$ErrorActionPreference = 'Stop'\n"
          + "if ((Microsoft.PowerShell.Security\\Get-AuthenticodeSignature -LiteralPath $env:TEAMRUN_SIGNING_FILE).Status -eq 'Valid') { exit 0 }\n"
          + "Microsoft.PowerShell.Core\\Import-Module "), script);
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

    test("electron-builder's own hook loader loads the TypeScript hook and finds its signing function", async () => {
      const builderRequire = createRequire(createRequire(import.meta.url).resolve("electron-builder"));
      const loader: unknown = builderRequire("app-builder-lib/out/util/resolve.js");
      const resolveFunction: unknown = typeof loader === "object" && loader !== null ? Reflect.get(loader, "resolveFunction") : null;
      const root = SourceTreeFixture.root;
      assert.ok(typeof resolveFunction === "function");

      const hook: unknown = await Reflect.apply(resolveFunction, undefined, [undefined, path.join(root, "scripts", "packaging", "windows-sign-hook.ts"), "sign", root]);

      assert.ok(typeof hook === "function");
      assert.equal(hook.name, signWindowsFile.name);
    });
  }

  private static async createAsync(t: TestContext): Promise<[RepositoryFixture, PackageGalleryFixture]> {
    const repository = await RepositoryFixture.createAsync();
    const gallery = await PackageGalleryFixture.createAsync();
    t.after(() => Promise.all([repository.disposeAsync(), gallery.disposeAsync()]));
    return [repository, gallery];
  }
}

TrustedSigningModuleTests.register();
