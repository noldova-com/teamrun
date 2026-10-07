/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";

import AngularProject from "../angular/angular-project.ts";
import GalleryFile from "../angular/gallery-file.ts";
import Package from "../package.ts";
import PackageStage from "../packaging/package-stage.ts";
import PackagedBuild from "../packaging/packaged-build.ts";
import type PinnedPackage from "../packaging/pinned-package.ts";
import SigningCredentials from "../packaging/signing-credentials.ts";
import TrustedSigningModule from "../packaging/trusted-signing-module.ts";
import ProcessResult from "../processes/process-result.ts";
import ProcessRunner from "../processes/process-runner.ts";
import NpmCommand from "../toolchain/npm-command.ts";
import PackageArchivesFixture from "./fixtures/package-archives.fixture.ts";
import PackageGalleryFixture from "./fixtures/package-gallery.fixture.ts";
import PackagedBuildFixture from "./fixtures/packaged-build.fixture.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BuilderFixture extends ProcessRunnerFixture {
  private readonly made: readonly string[];
  private readonly failure: Error | null;

  public constructor(made: readonly string[], exitCodes: readonly number[] = [], failure: Error | null = null, captures: readonly ProcessResult[] = []) {
    super(exitCodes, captures);

    this.made = made;
    this.failure = failure;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    if (this.failure !== null)
      throw this.failure;
    const configuration = JSON.parse(await readFile(String(commandArguments.at(-1)), "utf8")) as { readonly directories: { readonly output: string } };
    await mkdir(configuration.directories.output, { recursive: true });
    for (const file of this.made) {
      await mkdir(path.dirname(path.join(configuration.directories.output, file)), { recursive: true });
      await writeFile(path.join(configuration.directories.output, file), "package\n");
    }
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class CredentialWitnessFixture extends ProcessRunner {
  public readonly seen: (readonly string[])[] = [];

  public static find(environment: NodeJS.ProcessEnv | undefined): readonly string[] {
    return Object.keys(environment ?? {}).filter(t => SigningCredentials.NAMES.includes(t.toUpperCase()));
  }

  public override captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    this.seen.push(CredentialWitnessFixture.find(environment ?? process.env));
    return super.captureAsync(command, commandArguments, directory, timeout, environment);
  }
}

class KeyWitnessFixture extends BuilderFixture {
  private static readonly PERMISSIONS: number = 0o777;

  public readonly keys: ([string, number] | null)[] = [];

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const key = String(environment?.["APPLE_API_KEY"]);
    this.keys.push(existsSync(key) ? [await readFile(key, "utf8"), (await stat(key)).mode & KeyWitnessFixture.PERMISSIONS] : null);
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class PackageTests {

  private static readonly TIMEOUT: number = 120_000;
  private static readonly USAGE: string = "Usage: npm run package [-- [--signed] [--update-feed <https URL, or http URL of localhost, ending in />]]\n";
  private static readonly GALLERY: readonly PinnedPackage[] = TrustedSigningModule.PACKAGES;
  private static readonly CREDENTIALS: Readonly<Record<string, string>> = {
    AZURE_TENANT_ID: "fixture-tenant",
    AZURE_CLIENT_ID: "fixture-client",
    AZURE_CLIENT_SECRET: "fixture-secret"
  };
  private static readonly MAC_CREDENTIALS: Readonly<Record<string, string>> = {
    MAC_CERTIFICATE: "fixture-certificate",
    MAC_CERTIFICATE_PASSWORD: "fixture-password",
    APPLE_API_KEY_P8: "fixture-key",
    APPLE_API_KEY_ID: "fixture-key-id",
    APPLE_API_ISSUER: "fixture-issuer"
  };
  private static readonly APPLE_DETAILS: string = "Authority=Developer ID Application: Fixture Works (FIXTURE123)\nTeamIdentifier=FIXTURE123\n";
  private static readonly APP_IMAGE: string = "Fixture Studio-linux-x64.AppImage";
  private static readonly STAGED: string = "The packaged window holds no Gallery.\nPackages in the stage: @noldova/teamrun-foundation-beta, "
    + "@noldova/teamrun-foundation-alpha, @noldova/teamrun-shell-cli, @noldova/teamrun-shell-desktop.\nThird-party packages in the stage: none.\n";

  private static archives: PackageArchivesFixture | null = null;

  public static register(): void {
    before(async () => {
      PackageTests.archives = await PackageArchivesFixture.createAsync();
    });
    after(() => PackageTests.archives?.disposeAsync());

    test("packaging stages the app, writes the configuration for the host and runs electron-builder with its own CommonJS tool cache, no signing identity and only the variables it needs",
      { timeout: PackageTests.TIMEOUT }, async t => {
        const repository = await PackageTests.createAsync(t);
        const builder = new BuilderFixture([PackageTests.APP_IMAGE]);
        const output = new TextOutputFixture();
        const folder = path.join(repository.directory, "_build", "package", "out");
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "TeamRun-linux-x64.AppImage"), "old\n");
        const environment = {
          Path: "fixture-path",
          HOME: "fixture-home",
          GH_TOKEN: "fixture-token",
          CSC_LINK: "fixture-certificate",
          WIN_CSC_LINK: "fixture-certificate",
          CSC_NAME: "Fixture Identity",
          APPIMAGE_TOOLS_PATH: "fixture-tools",
          ELECTRON_BUILDER_NSIS_DIR: "fixture-tools",
          ELECTRON_BUILDER_RCEDIT_PATH: "fixture-tools",
          ELECTRON_BUILDER_ICONS_TOOLSET_DIR: "fixture-tools",
          ELECTRON_BUILDER_CACHE: "fixture-cache",
          CSC_IDENTITY_AUTO_DISCOVERY: "true"
        };

        const exitCode = await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, environment, output, PackageTests.GALLERY).runAsync([]);

        const file = path.join(repository.directory, "_build", "package", "electron-builder.json");
        assert.equal(exitCode, 0, output.text);
        assert.deepEqual(builder.runs, [[process.execPath, repository.directory, path.join(repository.directory, "node_modules", "electron-builder", "cli.js"), "--publish", "never", "--config", file]]);
        assert.deepEqual(builder.environments, [{
          Path: "fixture-path",
          HOME: "fixture-home",
          ELECTRON_BUILDER_CACHE: path.join(repository.directory, "_build", "package", "tool-cache"),
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
        }]);
        const configuration = JSON.parse(await readFile(file, "utf8")) as Readonly<Record<string, unknown>>;
        assert.equal(configuration["appId"], "org.fixtureworks.studio");
        assert.equal(configuration["electronVersion"], "44.5.1");
        assert.equal(configuration["electronDist"], path.join(repository.directory, "_build", "package", "electron"));
        assert.equal(await readFile(path.join(repository.directory, "_build", "package", "electron", "electron"), "utf8"), "program\n");
        assert.deepEqual(configuration["directories"], { app: path.join(repository.directory, "_build", "package", "app"), output: folder });
        assert.equal(existsSync(path.join(repository.directory, "_build", "package", "app", "node_modules", "@noldova", "teamrun-shell-desktop", "package.json")), true);
        assert.equal(await readFile(path.join(repository.directory, "_build", "package", "tool-cache", "package.json"), "utf8"), "{\"type\":\"commonjs\"}\n");
        assert.equal(existsSync(path.join(folder, "TeamRun-linux-x64.AppImage")), false);
        assert.equal(output.text, `${PackageTests.STAGED}Packages made:\n  ${path.join(folder, PackageTests.APP_IMAGE)}\n`);
        assert.deepEqual(JSON.parse(await readFile(path.join(repository.directory, "_build", "package", "package-report.json"), "utf8")),
          { target: "linux-x64", signed: false, checked: false });
      });

    test("electron-builder compresses a Windows ARM64 package with the x86 filter that the installer's extractor reads, and leaves every other target's filter alone",
      { timeout: PackageTests.TIMEOUT }, async t => {
        const repository = await PackageTests.createAsync(t);
        const targets: readonly (readonly [string, string, readonly string[]])[] = [
          ["win32", "arm64", ["Fixture Studio-windows-arm64.exe"]],
          ["win32", "x64", ["Fixture Studio-windows-x64.exe"]],
          ["darwin", "arm64", ["Fixture Studio-macos-arm64.dmg", "Fixture Studio-macos-arm64.zip"]],
          ["linux", "arm64", ["Fixture Studio-linux-arm64.AppImage"]]
        ];
        const filters: (string | undefined)[] = [];

        for (const [platform, architecture, made] of targets) {
          const builder = new BuilderFixture(made);
          const output = new TextOutputFixture();
          const exitCode = await new Package(repository.directory, platform, architecture, PackageTests.createStage(repository), builder,
            { ELECTRON_BUILDER_7Z_FILTER: "ARM64" }, output, PackageTests.GALLERY).runAsync([]);
          assert.equal(exitCode, 0, output.text);
          filters.push(builder.environments[0]?.["ELECTRON_BUILDER_7Z_FILTER"]);
        }

        assert.deepEqual(filters, ["BCJ", undefined, undefined, undefined]);
      });

    test("a failed electron-builder run or one that leaves a package unmade fails packaging, and no package report remains", { timeout: PackageTests.TIMEOUT }, async t => {
      const repository = await PackageTests.createAsync(t);
      const failed = new TextOutputFixture();
      const unmade = new TextOutputFixture();
      await repository.writeAsync({ "_build/package/package-report.json": "{}" });

      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), new BuilderFixture([], [3]), {}, failed, PackageTests.GALLERY).runAsync([]), 1);
      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), new BuilderFixture([]), {}, unmade, PackageTests.GALLERY).runAsync([]), 1);

      assert.equal(failed.text, `${PackageTests.STAGED}electron-builder failed with exit code 3.\n`);
      assert.equal(unmade.text, `${PackageTests.STAGED}electron-builder finished without making ${path.join(repository.directory, "_build", "package", "out", PackageTests.APP_IMAGE)}.\n`);
      assert.equal(existsSync(path.join(repository.directory, "_build", "package", "package-report.json")), false);
    });

    test("a host without packages, a failed packaged build or a module list the build refuses stops packaging before electron-builder runs, and no package report remains", async t => {
      const repository = await PackageTests.createAsync(t);
      const unlisted = await PackageTests.createAsync(t, ["absent"]);
      const builder = new BuilderFixture([PackageTests.APP_IMAGE]);
      const host = new TextOutputFixture();
      const staged = new TextOutputFixture();
      const modules = new TextOutputFixture();
      await repository.writeAsync({ "_build/package/package-report.json": "{}" });

      assert.equal(await new Package(repository.directory, "freebsd", "x64", PackageTests.createStage(repository), builder, {}, host, PackageTests.GALLERY).runAsync([]), 1);
      assert.equal(existsSync(path.join(repository.directory, "_build", "package", "package-report.json")), false);
      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository, [2]), builder, {}, staged, PackageTests.GALLERY).runAsync([]), 1);
      assert.equal(await new Package(unlisted.directory, "linux", "x64", PackageTests.createStage(unlisted), builder, {}, modules, PackageTests.GALLERY).runAsync([]), 1);

      assert.equal(host.text, "Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64.\n");
      assert.equal(staged.text, "The packaged build failed with exit code 2.\n");
      assert.equal(modules.text, "The packaged window holds no Gallery.\nThe build lists the module absent, but src/modules/absent has no module.json.\n");
      assert.deepEqual(builder.runs, []);
    });

    test("--signed takes the Azure credentials out of the environment before staging, signs a Windows package through the hook with the pinned packages and only electron-builder "
      + "holding the credentials, then checks the installer's, the program's and the addons' signatures",
      { timeout: PackageTests.TIMEOUT }, async t => {
        const repository = await PackageTests.createAsync(t);
        const gallery = await PackageGalleryFixture.createAsync();
        t.after(() => gallery.disposeAsync());
        const addon = path.join("win-unpacked", "resources", "app.asar.unpacked", "node_modules", "@noldova", "teamrun-shell-runtime", "addon", "windows.node");
        const made = ["Fixture Studio-windows-x64.exe", path.join("win-unpacked", "Fixture Studio.exe"), addon];
        const builder = new BuilderFixture(made, [], null, [new ProcessResult(0, "", ""), new ProcessResult(0, "Every file is signed.\r\n", "")]);
        const npm = new CredentialWitnessFixture();
        const output = new TextOutputFixture();
        Object.assign(process.env, PackageTests.CREDENTIALS, PackageTests.MAC_CREDENTIALS);
        t.after(() => {
          for (const name of SigningCredentials.NAMES)
            Reflect.deleteProperty(process.env, name);
        });

        const exitCode = await new Package(repository.directory, "win32", "x64", PackageTests.createStage(repository, [], npm), builder, process.env, output, gallery.packages)
          .runAsync(["--signed"]);

        const folder = path.join(repository.directory, "_build", "package");
        const files = made.map(t => path.join(folder, "out", t));
        const configuration = JSON.parse(await readFile(path.join(folder, "electron-builder.json"), "utf8")) as { readonly forceCodeSigning: boolean; readonly win: Readonly<Record<string, unknown>> };
        assert.equal(exitCode, 0, output.text);
        assert.deepEqual(gallery.requests, ["/module", "/tool"]);
        assert.ok(npm.seen.length > 0);
        assert.deepEqual(npm.seen.filter(t => t.length > 0), []);
        assert.deepEqual(builder.captureEnvironments.map(t => CredentialWitnessFixture.find(t)), [[], []]);
        assert.deepEqual(CredentialWitnessFixture.find(process.env), []);
        assert.deepEqual(builder.environments.map(t => Object.fromEntries(Object.entries(t ?? {})
          .filter(([name]) => [...SigningCredentials.NAMES, "CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_API_KEY"].includes(name) || name.startsWith("TEAMRUN_")))), [{
          ...PackageTests.CREDENTIALS,
          TEAMRUN_SIGNING_FOLDER: path.join(folder, "signing")
        }]);
        assert.equal(configuration.forceCodeSigning, true);
        assert.deepEqual(configuration.win["signtoolOptions"], {
          sign: path.join(repository.directory, "scripts", "packaging", "windows-sign-hook.ts"),
          signingHashAlgorithms: ["sha256"],
          publisherName: "CN=Fixture Works, O=Fixture Works, L=Fixtureville, C=US"
        });
        assert.deepEqual(builder.captured.map(t => [t[0], t[1]]), [["pwsh", path.join(folder, "signing")], ["pwsh", repository.directory]]);
        assert.equal(builder.captureEnvironments[1]?.["TEAMRUN_SIGNED_FILES"], files.join("\n"));
        assert.equal(builder.captureEnvironments[1]?.["TEAMRUN_WINDOWS_PUBLISHER"], "CN=Fixture Works, O=Fixture Works, L=Fixtureville, C=US");
        assert.equal(output.text, `${PackageTests.STAGED}Packages made:\n  ${files[0]}\nSignatures:\nEvery file is signed.\n`);
        assert.deepEqual(JSON.parse(await readFile(path.join(folder, "package-report.json"), "utf8")), { target: "windows-x64", signed: true, checked: true });
      });

    test("--signed signs and notarizes a macOS package with the certificate and the App Store Connect key that only electron-builder receives, the key in a private file "
      + "that is removed afterwards, notarizes and staples the disk image, then checks the disk image and the app in it and in the archive", { timeout: PackageTests.TIMEOUT }, async t => {
        const repository = await PackageTests.createAsync(t);
        const made = ["Fixture Studio-macos-arm64.dmg", "Fixture Studio-macos-arm64.zip"];
        const succeeded = new ProcessResult(0, "", "");
        const checks = [
          new ProcessResult(0, "valid on disk\n", ""),
          new ProcessResult(0, PackageTests.APPLE_DETAILS, ""),
          new ProcessResult(0, "accepted\nsource=Notarized Developer ID\n", ""),
          new ProcessResult(0, "The validate action worked!\n", "")
        ];
        const accepted = new ProcessResult(0, "{\"id\":\"fixture-submission\",\"status\":\"Accepted\",\"message\":\"Processing complete\"}\n", "");
        const builder = new KeyWitnessFixture(made, [], null, [accepted, succeeded, ...checks, succeeded, ...checks, succeeded, succeeded, ...checks]);
        const output = new TextOutputFixture();
        const environment: NodeJS.ProcessEnv = { ...PackageTests.CREDENTIALS, ...PackageTests.MAC_CREDENTIALS, HOME: "fixture-home" };

        const exitCode = await new Package(repository.directory, "darwin", "arm64", PackageTests.createStage(repository), builder, environment, output, PackageTests.GALLERY)
          .runAsync(["--signed"]);

        const folder = path.join(repository.directory, "_build", "package");
        const signing = path.join(folder, "signing");
        const check = path.join(signing, "check");
        const files = made.map(t => path.join(folder, "out", t));
        const app = (index: number): string => path.join(check, String(index), "Fixture Studio.app");
        const configuration = JSON.parse(await readFile(path.join(folder, "electron-builder.json"), "utf8")) as {
          readonly mac: Readonly<Record<string, unknown>>;
          readonly dmg: Readonly<Record<string, unknown>>;
        };
        assert.equal(exitCode, 0, output.text);
        assert.deepEqual(environment, { HOME: "fixture-home" });
        assert.deepEqual(builder.environments, [{
          HOME: "fixture-home",
          ELECTRON_BUILDER_CACHE: path.join(folder, "tool-cache"),
          CSC_IDENTITY_AUTO_DISCOVERY: "true",
          CSC_LINK: "fixture-certificate",
          CSC_KEY_PASSWORD: "fixture-password",
          APPLE_API_KEY: path.join(signing, "notarization-key.p8"),
          APPLE_API_KEY_ID: "fixture-key-id",
          APPLE_API_ISSUER: "fixture-issuer"
        }]);
        assert.deepEqual(builder.keys, [["fixture-key", process.platform === "win32" ? builder.keys[0]?.[1] : 0o600]]);
        assert.equal(existsSync(signing), false);
        assert.deepEqual(JSON.parse(await readFile(path.join(folder, "package-report.json"), "utf8")), { target: "macos-arm64", signed: true, checked: true });
        assert.equal(configuration.mac["notarize"], true);
        assert.deepEqual(configuration.dmg, { sign: true });
        assert.deepEqual(builder.captured, [
          ["xcrun", signing, "notarytool", "submit", files[0] ?? "", "--key", path.join(signing, "notarization-key.p8"), "--key-id", "fixture-key-id", "--issuer", "fixture-issuer",
            "--wait", "--timeout", "1h", "--output-format", "json"],
          ["xcrun", signing, "stapler", "staple", files[0] ?? ""],
          ["codesign", check, "--verify", "--strict", "--verbose=2", files[0] ?? ""],
          ["codesign", check, "--display", "--verbose=2", files[0] ?? ""],
          ["spctl", check, "--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=2", files[0] ?? ""],
          ["xcrun", check, "stapler", "validate", files[0] ?? ""],
          ["hdiutil", check, "attach", "-readonly", "-nobrowse", "-noautoopen", "-mountpoint", path.join(check, "0"), files[0] ?? ""],
          ["codesign", check, "--verify", "--deep", "--strict", "--verbose=2", app(0)],
          ["codesign", check, "--display", "--verbose=2", app(0)],
          ["spctl", check, "--assess", "--type", "execute", "--verbose=2", app(0)],
          ["xcrun", check, "stapler", "validate", app(0)],
          ["hdiutil", check, "detach", path.join(check, "0"), "-force"],
          ["ditto", check, "-x", "-k", files[1] ?? "", path.join(check, "1")],
          ["codesign", check, "--verify", "--deep", "--strict", "--verbose=2", app(1)],
          ["codesign", check, "--display", "--verbose=2", app(1)],
          ["spctl", check, "--assess", "--type", "execute", "--verbose=2", app(1)],
          ["xcrun", check, "stapler", "validate", app(1)]
        ]);
        assert.deepEqual(builder.captureEnvironments.map(t => CredentialWitnessFixture.find(t)), Array.from({ length: 17 }, () => []));
        assert.equal(output.text, `${PackageTests.STAGED}Packages made:\n${files.map(t => `  ${t}\n`).join("")}Signatures:\n`
          + `${files[0]}: the disk image and its app each have a valid Developer ID Application signature, notarized and stapled.\n`
          + `${files[1]}: a valid Developer ID Application signature, notarized and stapled.\n`);
      });

    test("--signed is refused for macOS without every certificate and key credential before anything is staged, and a failed check still removes the key",
      { timeout: PackageTests.TIMEOUT }, async t => {
        const repository = await PackageTests.createAsync(t);
        const made = ["Fixture Studio-macos-x64.dmg", "Fixture Studio-macos-x64.zip"];
        const accepted = new ProcessResult(0, "{\"id\":\"fixture-submission\",\"status\":\"Accepted\",\"message\":\"Processing complete\"}\n", "");
        const invalid = "{\"id\":\"fixture-submission\",\"status\":\"Invalid\",\"message\":\"Processing complete\"}";
        const unnotarizedBuilder = new BuilderFixture(made, [], null, [new ProcessResult(0, `${invalid}\n`, "")]);
        const unstapledBuilder = new BuilderFixture(made, [], null, [accepted, new ProcessResult(65, "", "The staple and validate action failed! Error 65.\n")]);
        const uncheckedBuilder = new BuilderFixture(made, [], null, [accepted, new ProcessResult(0, "", ""), new ProcessResult(1, "", "code object is not signed at all\n"),
          new ProcessResult(0, "", ""), new ProcessResult(3, "", "rejected\n"), new ProcessResult(65, "", "does not have a ticket stapled to it\n")]);
        const [uncredentialed, unnotarized, unstapled, unchecked] = [1, 2, 3, 4].map(() => new TextOutputFixture());
        assert.ok(uncredentialed !== undefined && unnotarized !== undefined && unstapled !== undefined && unchecked !== undefined);
        const empty = new BuilderFixture([]);
        const runAsync = (builder: BuilderFixture, output: TextOutputFixture): Promise<number> =>
          new Package(repository.directory, "darwin", "x64", PackageTests.createStage(repository), builder, { ...PackageTests.MAC_CREDENTIALS }, output, PackageTests.GALLERY).runAsync(["--signed"]);

        const exitCodes = [
          await new Package(repository.directory, "darwin", "x64", PackageTests.createStage(repository), empty, { MAC_CERTIFICATE: "fixture-certificate", APPLE_API_KEY_ID: "" },
            uncredentialed, PackageTests.GALLERY).runAsync(["--signed"]),
          await runAsync(unnotarizedBuilder, unnotarized),
          await runAsync(unstapledBuilder, unstapled),
          await runAsync(uncheckedBuilder, unchecked)
        ];

        const image = path.join(repository.directory, "_build", "package", "out", made[0] ?? "");
        assert.deepEqual(exitCodes, [1, 1, 1, 1]);
        assert.deepEqual(empty.runs, []);
        assert.equal(uncredentialed.text, "Signing macOS packages needs MAC_CERTIFICATE_PASSWORD, APPLE_API_KEY_P8, APPLE_API_KEY_ID, APPLE_API_ISSUER, "
          + "the Developer ID Application certificate and the App Store Connect key that notarizes.\n");
        assert.ok(unnotarized.text.endsWith(`Apple did not notarize the disk image ${image}:\n${invalid}\n`), unnotarized.text);
        assert.ok(unstapled.text.endsWith(`The notarization ticket could not be stapled to the disk image ${image}:\nThe staple and validate action failed! Error 65.\n`), unstapled.text);
        assert.ok(unchecked.text.endsWith(`The disk image ${image} lacks a valid signature, a Developer ID Application signature, notarization, a stapled ticket:\n`
          + "code object is not signed at all\n\nrejected\ndoes not have a ticket stapled to it\n"), unchecked.text);
        assert.deepEqual([unnotarizedBuilder, unstapledBuilder, uncheckedBuilder].map(t => t.captured.length), [1, 2, 6]);
        assert.ok(!unnotarized.text.includes("fixture-key-id") && !unnotarized.text.includes("fixture-issuer"), unnotarized.text);
        assert.equal(existsSync(path.join(repository.directory, "_build", "package", "signing")), false);
        assert.equal(existsSync(path.join(repository.directory, "_build", "package", "package-report.json")), false);
      });

    test("--signed is refused for other platforms and without every Azure credential before anything is staged, and an ARM64 package without addons checks its installer and program",
      { timeout: PackageTests.TIMEOUT }, async t => {
        const repository = await PackageTests.createAsync(t);
        const gallery = await PackageGalleryFixture.createAsync();
        t.after(() => gallery.disposeAsync());
        const made = ["Fixture Studio-windows-arm64.exe", path.join("win-arm64-unpacked", "Fixture Studio.exe")];
        const signed = new BuilderFixture(made, [], null, [new ProcessResult(0, "", ""), new ProcessResult(0, "Signed.", "")]);
        const unchecked = new BuilderFixture(made, [], null, [new ProcessResult(0, "", ""), new ProcessResult(1, "Not signed.", "")]);
        const programless = new BuilderFixture([made[0] ?? ""], [], null, [new ProcessResult(0, "", "")]);
        const [linux, uncredentialed, twice, arm64, unverified, missing] = [1, 2, 3, 4, 5, 6].map(() => new TextOutputFixture());
        const runAsync = (platform: string, architecture: string, builder: BuilderFixture, environment: NodeJS.ProcessEnv, output: TextOutputFixture, options: readonly string[] = ["--signed"]): Promise<number> =>
          new Package(repository.directory, platform, architecture, PackageTests.createStage(repository), builder, { ...environment }, output, gallery.packages).runAsync(options);
        assert.ok(linux !== undefined && uncredentialed !== undefined && twice !== undefined && arm64 !== undefined && unverified !== undefined && missing !== undefined);

        const exitCodes = [
          await runAsync("linux", "x64", new BuilderFixture([]), PackageTests.CREDENTIALS, linux, ["--update-feed", "http://127.0.0.1:8080/", "--signed"]),
          await runAsync("win32", "x64", new BuilderFixture([]), { AZURE_TENANT_ID: "fixture-tenant" }, uncredentialed),
          await runAsync("win32", "x64", new BuilderFixture([]), PackageTests.CREDENTIALS, twice, ["--signed", "--signed"]),
          await runAsync("win32", "arm64", signed, PackageTests.CREDENTIALS, arm64),
          await runAsync("win32", "arm64", unchecked, PackageTests.CREDENTIALS, unverified),
          await runAsync("win32", "arm64", programless, PackageTests.CREDENTIALS, missing)
        ];

        const out = path.join(repository.directory, "_build", "package", "out");
        assert.deepEqual(exitCodes, [1, 1, 2, 0, 1, 1]);
        assert.equal(linux.text, "--signed signs Windows and macOS packages only, so it cannot sign the linux-x64 package.\n");
        assert.equal(uncredentialed.text, "Signing Windows packages needs AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, the Azure service principal that signs with noldova-signing.\n");
        assert.equal(twice.text, PackageTests.USAGE);
        assert.equal(signed.captureEnvironments[1]?.["TEAMRUN_SIGNED_FILES"], made.map(t => path.join(out, t)).join("\n"));
        assert.equal(arm64.text, `${PackageTests.STAGED}Packages made:\n  ${path.join(out, made[0] ?? "")}\nSignatures:\nSigned.\n`);
        assert.ok(unverified.text.endsWith(
          "Not every file is signed by CN=Fixture Works, O=Fixture Works, L=Fixtureville, C=US with a valid, timestamped signature; pwsh exited with 1:\nNot signed.\n"));
        assert.ok(missing.text.endsWith(
          `electron-builder finished without the unpacked program ${path.join(out, "win-arm64-unpacked", "Fixture Studio.exe")}, whose signature the check reads.\n`));
      });

    test("an unexpected error reaches the caller", { timeout: PackageTests.TIMEOUT }, async t => {
      const repository = await PackageTests.createAsync(t);
      const builder = new BuilderFixture([], [], new RangeError("The fixture broke."));

      await assert.rejects(() => new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, {}, new TextOutputFixture(), PackageTests.GALLERY).runAsync([]),
        new RangeError("The fixture broke."));
    });

    test("any argument but --signed and one http or https update feed ending in a slash is refused with the usage after any earlier package report is removed, and the command exits with that result", async t => {
      const repository = await PackageTests.createAsync(t);
      const output = new TextOutputFixture();
      const builder = new BuilderFixture([]);
      await repository.writeAsync({ "_build/package/package-report.json": "{}" });

      const exitCode = await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, {}, output, PackageTests.GALLERY).runAsync(["--target", "linux"]);
      const feeds = [["--update-feed"], ["--signed", "--update-feed", "ftp://a/"], ["--update-feed", "http://a"], ["--update-feed", "http://a/", "--update-feed", "http://a/"]];
      const feedCodes: number[] = [];
      const feedOutput = new TextOutputFixture();
      for (const options of feeds)
        feedCodes.push(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, {}, feedOutput, PackageTests.GALLERY).runAsync(options));
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("package.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(exitCode, 2);
      assert.equal(output.text, PackageTests.USAGE);
      assert.deepEqual(feedCodes, [2, 2, 2, 2]);
      assert.equal(feedOutput.text, PackageTests.USAGE.repeat(4));
      assert.deepEqual(await readdir(path.join(repository.directory, "_build", "package")), []);
      assert.deepEqual(builder.runs, []);
      assert.equal(command.status, 2);
      assert.equal(command.stdout, PackageTests.USAGE);
    });
  }

  private static createStage(repository: RepositoryFixture, exitCodes: readonly number[] = [], npmRunner: ProcessRunner = new ProcessRunner()): PackageStage {
    const gallery = new GalleryFile(repository.directory);
    const npm = new NpmCommand(npmRunner, process.env);
    const angular = new AngularProject(repository.directory, new ProcessRunner(), npm);
    return new PackageStage(repository.directory, npm, new PackagedBuild(repository.directory, new PackagedBuildFixture(gallery, exitCodes), gallery, angular));
  }

  private static async createAsync(t: TestContext, modules: readonly string[] = []): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    assert.ok(PackageTests.archives !== null);
    await PackageTests.archives.writeSourcesAsync(repository, modules);
    await repository.writeAsync({
      "node_modules/electron/package.json": JSON.stringify({ name: "electron", version: "44.5.1" }),
      "node_modules/electron/dist/electron": "program\n"
    });
    return repository;
  }
}

PackageTests.register();
