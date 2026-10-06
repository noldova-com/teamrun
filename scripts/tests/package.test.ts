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
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";

import AngularProject from "../angular/angular-project.ts";
import GalleryFile from "../angular/gallery-file.ts";
import Package from "../package.ts";
import PackageStage from "../packaging/package-stage.ts";
import PackagedBuild from "../packaging/packaged-build.ts";
import type PinnedPackage from "../packaging/pinned-package.ts";
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
  public static readonly NAMES: readonly string[] = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];

  public readonly seen: (readonly string[])[] = [];

  public static find(environment: NodeJS.ProcessEnv | undefined): readonly string[] {
    return Object.keys(environment ?? {}).filter(t => CredentialWitnessFixture.NAMES.includes(t.toUpperCase()));
  }

  public override captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    this.seen.push(CredentialWitnessFixture.find(environment ?? process.env));
    return super.captureAsync(command, commandArguments, directory, timeout, environment);
  }
}

class PackageTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly USAGE: string = "Usage: npm run package [-- --signed]\n";
  private static readonly GALLERY: readonly PinnedPackage[] = TrustedSigningModule.PACKAGES;
  private static readonly CREDENTIALS: Readonly<Record<string, string>> = {
    AZURE_TENANT_ID: "fixture-tenant",
    AZURE_CLIENT_ID: "fixture-client",
    AZURE_CLIENT_SECRET: "fixture-secret"
  };
  private static readonly APP_IMAGE: string = "Fixture Studio-linux-x64.AppImage";
  private static readonly STAGED: string = "The packaged window holds no Gallery.\nPackages in the stage: @noldova/teamrun-foundation-beta, "
    + "@noldova/teamrun-foundation-alpha, @noldova/teamrun-shell-cli, @noldova/teamrun-shell-desktop.\n";

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

    test("a failed electron-builder run or one that leaves a package unmade fails packaging", { timeout: PackageTests.TIMEOUT }, async t => {
      const repository = await PackageTests.createAsync(t);
      const failed = new TextOutputFixture();
      const unmade = new TextOutputFixture();

      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), new BuilderFixture([], [3]), {}, failed, PackageTests.GALLERY).runAsync([]), 1);
      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), new BuilderFixture([]), {}, unmade, PackageTests.GALLERY).runAsync([]), 1);

      assert.equal(failed.text, `${PackageTests.STAGED}electron-builder failed with exit code 3.\n`);
      assert.equal(unmade.text, `${PackageTests.STAGED}electron-builder finished without making ${path.join(repository.directory, "_build", "package", "out", PackageTests.APP_IMAGE)}.\n`);
    });

    test("a host without packages, a failed packaged build or a module list the build refuses stops packaging before electron-builder runs", async t => {
      const repository = await PackageTests.createAsync(t);
      const unlisted = await PackageTests.createAsync(t, ["absent"]);
      const builder = new BuilderFixture([PackageTests.APP_IMAGE]);
      const host = new TextOutputFixture();
      const staged = new TextOutputFixture();
      const modules = new TextOutputFixture();

      assert.equal(await new Package(repository.directory, "freebsd", "x64", PackageTests.createStage(repository), builder, {}, host, PackageTests.GALLERY).runAsync([]), 1);
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
        Object.assign(process.env, PackageTests.CREDENTIALS);
        t.after(() => {
          for (const name of CredentialWitnessFixture.NAMES)
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
          .filter(([name]) => CredentialWitnessFixture.NAMES.includes(name) || name.startsWith("TEAMRUN_")))), [{
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
          await runAsync("linux", "x64", new BuilderFixture([]), PackageTests.CREDENTIALS, linux),
          await runAsync("win32", "x64", new BuilderFixture([]), { AZURE_TENANT_ID: "fixture-tenant" }, uncredentialed),
          await runAsync("win32", "x64", new BuilderFixture([]), PackageTests.CREDENTIALS, twice, ["--signed", "--signed"]),
          await runAsync("win32", "arm64", signed, PackageTests.CREDENTIALS, arm64),
          await runAsync("win32", "arm64", unchecked, PackageTests.CREDENTIALS, unverified),
          await runAsync("win32", "arm64", programless, PackageTests.CREDENTIALS, missing)
        ];

        const out = path.join(repository.directory, "_build", "package", "out");
        assert.deepEqual(exitCodes, [1, 1, 2, 0, 1, 1]);
        assert.equal(linux.text, "--signed signs Windows packages only, so it cannot sign the linux-x64 package.\n");
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

    test("any argument is refused with the usage, and the command exits with that result", async t => {
      const repository = await PackageTests.createAsync(t);
      const output = new TextOutputFixture();
      const builder = new BuilderFixture([]);

      const exitCode = await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, {}, output, PackageTests.GALLERY).runAsync(["--target", "linux"]);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("package.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(exitCode, 2);
      assert.equal(output.text, PackageTests.USAGE);
      assert.equal(existsSync(path.join(repository.directory, "_build", "package")), false);
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
