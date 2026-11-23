/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  CodexAppServerDownload,
  CommandRunner,
  ExecutableSource,
  LocatedExecutable,
  NodeProcessStarter,
  ProcessTerminator,
  Resources
} from "@noldova/teamrun.providers";

import { FakeTar } from "../../fixtures/fake-tar.fixture.js";
import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

class DownloadSetup {
  public static readonly LINUX: string = "x86_64-unknown-linux-musl";

  public readonly server: LocalHttpServer;
  public readonly directory: TemporaryDirectory;
  public readonly root: string;
  public readonly log: RecordingLog = new RecordingLog();

  public constructor(server: LocalHttpServer, directory: TemporaryDirectory) {
    this.server = server;
    this.directory = directory;
    this.root = directory.resolve("providers", "codex-app-server");
  }

  public create(platform: string = "linux", target: string | null = DownloadSetup.LINUX, extractor: LocatedExecutable | null | undefined = undefined,
    remove: ((path: string) => void) | undefined = undefined, unpackTimeout: number = 60_000): CodexAppServerDownload {
    const runner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    return new CodexAppServerDownload(this.root, this.server.url("/tags/"), target, platform, Object.isUndefined(extractor) ? FakeTar.create(this.directory.path) : extractor,
      runner, unpackTimeout, this.log, remove);
  }

  public publish(version: string, archive: Buffer, target: string = DownloadSetup.LINUX, digest: string = DownloadSetup.sha256(archive), linked: boolean = true): void {
    const name = `codex-app-server-package-${target}.tar.gz`;
    const other = { name: `codex-package-${target}.tar.gz`, digest: `sha256:${"0".repeat(64)}`, browser_download_url: this.server.url("/other") };
    const url = linked ? { browser_download_url: this.server.url(`/packages/${version}/${name}`) } : {};
    this.server.serve(`/tags/rust-v${version}`, Buffer.from(JSON.stringify({ tag_name: `rust-v${version}`,
      assets: [other, { name, digest, size: archive.length, ...url }] })))
      .serve(`/packages/${version}/${name}`, archive, 200, false);
  }

  public static sha256(archive: Buffer): string {
    return `sha256:${createHash("sha256").update(archive).digest("hex")}`;
  }

  public get logged(): string {
    return this.log.lines.join("\n");
  }

  public paths(): string {
    return this.server.requests.map(t => t.split(" ")[0]).join(",");
  }
}

@TestClass
export class CodexAppServerDownloadTests {
  private static readonly WINDOWS: string = "x86_64-pc-windows-msvc";
  private static readonly POSIX_MEMBERS: readonly string[] = ["bin/codex-app-server", "bin/codex-code-mode-host", "bin/codex-exec-server", "codex-path/rg",
    "codex-resources/bwrap", "codex-package.json"];

  @TestMethod
  public downloadsTheVersionsAppServerPackageOnceItPassesItsCheckAndKeepsOnlyThatVersion(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS));
      mkdirSync(join(setup.root, "0.170.0-x86_64-unknown-linux-musl", "bin"), { recursive: true });
      writeFileSync(join(setup.root, "0.170.0-x86_64-unknown-linux-musl", "bin", "codex-app-server"), "old");
      const download = setup.create();
      Assert.isNull(download.programOf("0.171.0"));

      const first = download.fetch("0.171.0", new AbortController().signal);
      const second = download.fetch("0.171.0", new AbortController().signal);
      const program = await first;

      const folder = join(setup.root, "0.171.0-x86_64-unknown-linux-musl");
      Assert.isTrue(first === second);
      Assert.areEqual(join(folder, "bin", "codex-app-server"), program);
      Assert.areEqual(program, download.programOf("0.171.0"));
      Assert.areEqual("0.171.0-x86_64-unknown-linux-musl", readdirSync(setup.root).join(","));
      Assert.isTrue(CodexAppServerDownloadTests.POSIX_MEMBERS.every(t => existsSync(join(folder, t))));
      if (process.platform !== "win32") {
        Assert.isTrue(Resources.codexAppServerExecutableMembers.every(t => (statSync(join(folder, t)).mode & 0o111) !== 0));
        Assert.areEqual(0, statSync(join(folder, "codex-package.json")).mode & 0o111);
      }
      Assert.areEqual("/tags/rust-v0.171.0,/packages/0.171.0/codex-app-server-package-x86_64-unknown-linux-musl.tar.gz", setup.paths());
      Assert.areEqual(0, setup.log.lines.length);
    });
  }

  @TestMethod
  public keepsTheWindowsProgramWithItsExtensionAndLeavesItsFilesModesAlone(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(["bin/codex-app-server.exe", "codex-path/rg.exe", "bin/codex-app-server"]),
        CodexAppServerDownloadTests.WINDOWS);

      const program = await setup.create("win32", CodexAppServerDownloadTests.WINDOWS).fetch("0.171.0", new AbortController().signal);

      const folder = join(setup.root, "0.171.0-x86_64-pc-windows-msvc");
      Assert.areEqual(join(folder, "bin", "codex-app-server.exe"), program);
      if (process.platform !== "win32")
        Assert.areEqual(0, statSync(join(folder, "bin", "codex-app-server")).mode & 0o111);
    });
  }

  @TestMethod
  public keepsNothingAndLogsWhyWhenTheDownloadDoesNotMatchTheReleasesSha256(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS), DownloadSetup.LINUX,
        `sha256:${"1".repeat(64)}`);
      const download = setup.create();

      const program = await download.fetch("0.171.0", new AbortController().signal);

      Assert.isNull(program);
      Assert.isNull(download.programOf("0.171.0"));
      Assert.areEqual(String.empty, readdirSync(setup.root).join(","));
      Assert.areEqual(1, setup.log.lines.length);
      Assert.isTrue(setup.logged.startsWith("The Codex 0.171.0 app server wasn't downloaded, so Codex threads TeamRun starts still show in the Codex app: "),
        setup.logged);
    });
  }

  @TestMethod
  public logsWhyWhenTheReleaseListsNoAppServerPackageForThisComputer(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS), "aarch64-apple-darwin");

      const program = await setup.create().fetch("0.171.0", new AbortController().signal);

      Assert.isNull(program);
      Assert.areEqual("The Codex 0.171.0 app server wasn't downloaded, so Codex threads TeamRun starts still show in the Codex app: "
        + "Codex 0.171.0 lists no app server package for this computer with its SHA-256.", setup.log.lines.join("\n"));
      Assert.areEqual("/tags/rust-v0.171.0", setup.paths());
    });
  }

  @TestMethod
  public logsThePackageAsMissingWhenItsDigestIsNoSha256OrItHasNoAddress(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      const archive = CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS);
      setup.publish("0.170.0", archive, DownloadSetup.LINUX, `md5:${"1".repeat(32)}`);
      setup.publish("0.171.0", archive, DownloadSetup.LINUX, DownloadSetup.sha256(archive), false);
      const download = setup.create();

      const programs = await Promise.all([download.fetch("0.170.0", new AbortController().signal), download.fetch("0.171.0", new AbortController().signal)]);

      Assert.areEqual("[null,null]", JSON.stringify(programs));
      Assert.areEqual(["0.170.0", "0.171.0"].map(t => "The Codex " + t + " app server wasn't downloaded, so Codex threads TeamRun starts still show in the Codex app: "
        + "Codex " + t + " lists no app server package for this computer with its SHA-256.").join("|"), setup.log.lines.join("|"));
    });
  }

  @TestMethod
  public logsThatUnpackingWasStoppedWhenTarRunsPastItsTime(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS));
      const script = setup.directory.resolve("slow-tar.cjs");
      writeFileSync(script, "setTimeout(() => undefined, 60000);");

      const program = await setup.create("linux", DownloadSetup.LINUX, new LocatedExecutable(process.execPath, ExecutableSource.Path, [script]), undefined, 1)
        .fetch("0.171.0", new AbortController().signal);

      Assert.isNull(program);
      Assert.isTrue(setup.logged.endsWith("Unpacking the Codex app server download was stopped."), setup.logged);
      Assert.areEqual(String.empty, readdirSync(setup.root).join(","));
    });
  }

  @TestMethod
  public logsWhyWhenTheReleaseCantBeRead(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      const program = await setup.create().fetch("0.171.0", new AbortController().signal);

      Assert.isNull(program);
      Assert.areEqual("The Codex 0.171.0 app server wasn't downloaded, so Codex threads TeamRun starts still show in the Codex app: "
        + "Reading the Codex 0.171.0 release failed with HTTP status 404.", setup.logged);
    });
  }

  @TestMethod
  public logsTarsExitCodeWhenThePackageWontUnpackAndKeepsNothing(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", Buffer.from("not an archive"));

      const program = await setup.create().fetch("0.171.0", new AbortController().signal);

      Assert.isNull(program);
      Assert.areEqual(String.empty, readdirSync(setup.root).join(","));
      Assert.isTrue(setup.logged.endsWith("Unpacking the Codex app server download failed with exit code 9."), setup.logged);
    });
  }

  @TestMethod
  public logsThatThePackageIsIncompleteWhenItHasNoProgram(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(["codex-path/rg"]));

      const program = await setup.create().fetch("0.171.0", new AbortController().signal);

      Assert.isNull(program);
      Assert.areEqual(String.empty, readdirSync(setup.root).join(","));
      Assert.isTrue(setup.logged.endsWith("The Codex 0.171.0 app server package has no bin/codex-app-server."), setup.logged);
    });
  }

  @TestMethod
  public downloadsNothingWithoutTarOrABuildForThisComputer(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS));
      const withoutTar = setup.create("linux", DownloadSetup.LINUX, null);
      const withoutBuild = setup.create("linux", null);

      const programs = await Promise.all([withoutTar.fetch("0.171.0", new AbortController().signal), withoutBuild.fetch("0.171.0", new AbortController().signal)]);

      Assert.areEqual("[null,null]", JSON.stringify(programs));
      Assert.isNull(withoutBuild.programOf("0.171.0"));
      Assert.areEqual(String.empty, setup.paths());
      Assert.areEqual(0, setup.log.lines.length);
    });
  }

  @TestMethod
  public returnsTheProgramAlreadyThereWithoutReadingTheRelease(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      const program = join(setup.root, "0.171.0-x86_64-unknown-linux-musl", "bin", "codex-app-server");
      mkdirSync(join(program, ".."), { recursive: true });
      writeFileSync(program, "ready");

      Assert.areEqual(program, await setup.create().fetch("0.171.0", new AbortController().signal));
      Assert.areEqual(String.empty, setup.paths());
    });
  }

  @TestMethod
  public removesTheStagingFolderOfADownloadThatWasCutOffBeforeTheRunsFirstDownload(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS));
      const leftover = join(setup.root, ".teamrun-staging-cut-off", "package", "bin");
      mkdirSync(leftover, { recursive: true });
      writeFileSync(join(leftover, "codex-app-server"), "partial");

      const program = await setup.create().fetch("0.171.0", new AbortController().signal);

      Assert.areEqual(join(setup.root, "0.171.0-x86_64-unknown-linux-musl", "bin", "codex-app-server"), program);
      Assert.areEqual("0.171.0-x86_64-unknown-linux-musl", readdirSync(setup.root).join(","));
    });
  }

  @TestMethod
  public replacesAnIncompleteFolderOfTheVersionWithAPackageThatHasOnlyItsProgram(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(["bin/codex-app-server"]));
      const folder = join(setup.root, "0.171.0-x86_64-unknown-linux-musl");
      mkdirSync(join(folder, "codex-path"), { recursive: true });
      writeFileSync(join(folder, "codex-path", "half"), "half");

      const program = await setup.create().fetch("0.171.0", new AbortController().signal);

      Assert.areEqual(join(folder, "bin", "codex-app-server"), program);
      Assert.isFalse(existsSync(join(folder, "codex-path", "half")));
      Assert.areEqual("bin", readdirSync(folder).join(","));
    });
  }

  @TestMethod
  public keepsTheProgramAnotherRunPutInPlaceDuringTheDownload(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS));
      const folder = join(setup.root, "0.171.0-x86_64-unknown-linux-musl");
      const script = setup.directory.resolve("racing-tar.cjs");
      writeFileSync(script, `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv;
const files = JSON.parse(fs.readFileSync(args[args.indexOf("-xf") + 1], "utf8"));
for (const [name, text] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(args[args.indexOf("-C") + 1], name)), { recursive: true });
  fs.writeFileSync(path.join(args[args.indexOf("-C") + 1], name), text);
}
fs.mkdirSync(${JSON.stringify(join(folder, "bin"))}, { recursive: true });
fs.writeFileSync(${JSON.stringify(join(folder, "bin", "codex-app-server"))}, "other run");
`);

      const program = await setup.create("linux", DownloadSetup.LINUX, new LocatedExecutable(process.execPath, ExecutableSource.Path, [script]))
        .fetch("0.171.0", new AbortController().signal);

      Assert.areEqual(join(folder, "bin", "codex-app-server"), program);
      Assert.areEqual("other run", readFileSync(join(folder, "bin", "codex-app-server"), "utf8"));
      Assert.areEqual("0.171.0-x86_64-unknown-linux-musl", readdirSync(setup.root).join(","));
    });
  }

  @TestMethod
  public keepsTheNewProgramAndLogsAnOlderVersionThatCantBeRemoved(): Promise<void> {
    return CodexAppServerDownloadTests.withReleases(async setup => {
      setup.publish("0.171.0", CodexAppServerDownloadTests.package(CodexAppServerDownloadTests.POSIX_MEMBERS));
      const old = join(setup.root, "0.170.0-x86_64-unknown-linux-musl");
      mkdirSync(old, { recursive: true });
      const removed: string[] = [];
      const remove = (path: string): void => {
        if (path === old)
          throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
        removed.push(path);
      };

      const program = await setup.create("linux", DownloadSetup.LINUX, undefined, remove).fetch("0.171.0", new AbortController().signal);

      Assert.areEqual(join(setup.root, "0.171.0-x86_64-unknown-linux-musl", "bin", "codex-app-server"), program);
      Assert.areEqual(join(setup.root, "0.171.0-x86_64-unknown-linux-musl"), removed.join(","));
      Assert.isTrue(existsSync(old));
      Assert.areEqual(`An older Codex app server download at ${old} wasn't removed: EBUSY: resource busy or locked`, setup.log.lines.join("\n"));
    });
  }

  private static async withReleases(test: (setup: DownloadSetup) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(new DownloadSetup(server, directory));
  }

  private static package(members: readonly string[]): Buffer {
    return FakeTar.archive(Object.fromEntries(members.map(t => [t, t])));
  }
}
