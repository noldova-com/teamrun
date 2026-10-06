/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { LaunchException, ProcessLaunchCommand } from "@noldova/teamrun-shell-runtime";

import { AppImageFixture, type AppImageRun } from "../fixtures/app-image.fixture.js";
import { FileSystemPatchFixture } from "../fixtures/file-system-patch.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class ProcessLaunchCommandTests {
  private static readonly INHERITED_DESCRIPTOR: number = 9;
  private static readonly SHELL_ARGUMENTS: string = [
    "--noprofile",
    "--norc",
    "-p",
    "-c",
    "set -e; shopt -s failglob; for descriptor in /proc/self/fd/*; do descriptor=${descriptor##*/}; if (( descriptor > 2 )); then exec {descriptor}>&-; fi; done; exec -- \"$@\"",
    "teamrun-launch"
  ].join("|");

  @TestMethod
  public startsTheProgramDirectlyOutsideLinux(): void {
    const launchArguments = ["entry.js", "--data-dir", "/data"];

    for (const platform of ["win32", "darwin"]) {
      const command = new ProcessLaunchCommand(platform, "/opt/node", launchArguments);
      Assert.areEqual("/opt/node", command.executable);
      Assert.areEqual("entry.js|--data-dir|/data", command.arguments.join("|"));
    }
  }

  @TestMethod
  public startsTheProgramThroughBashOnLinux(): void {
    using fileSystem = new FileSystemPatchFixture(null);

    const command = new ProcessLaunchCommand("linux", "/opt/node", ["entry.js"]);

    Assert.areEqual("/bin/bash", command.executable);
    Assert.areEqual(`${ProcessLaunchCommandTests.SHELL_ARGUMENTS}|/opt/node|entry.js`, command.arguments.join("|"));
    Assert.areEqual("/bin/bash,/proc/self/fd,/proc/self/fd", fileSystem.checked.join(","));
  }

  @TestMethod
  public requiresExecutableBashOnLinux(): void {
    using _fileSystem = new FileSystemPatchFixture("/bin/bash");

    const exception = Assert.throws(() => new ProcessLaunchCommand("linux", "/opt/node", []), LaunchException);

    Assert.areEqual("Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions.", exception.message);
    Assert.isInstanceOf(exception.cause, Error);
  }

  @TestMethod
  public requiresTheDescriptorDirectoryOnLinux(): void {
    using _fileSystem = new FileSystemPatchFixture("/proc/self/fd");

    const exception = Assert.throws(() => new ProcessLaunchCommand("linux", "/opt/node", []), LaunchException);

    Assert.areEqual(
      "Starting a program on Linux requires access to /proc/self/fd. Ensure procfs is mounted at /proc and this process can read and traverse its descriptor directory.",
      exception.message);
    Assert.isInstanceOf(exception.cause, Error);
  }

  @TestMethod
  public requiresAnExecutable(): void {
    Assert.areEqual("executablePath", Assert.throws(() => new ProcessLaunchCommand("win32", " ", []), ArgumentException).parameterName);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async closesInheritedDescriptorsOnLinux(): Promise<void> {
    const command = new ProcessLaunchCommand("linux", "/bin/ls", ["/proc/self/fd"]);

    const direct = await ProcessLaunchCommandTests.listDescriptorsAsync("/bin/ls", ["/proc/self/fd"]);
    const launched = await ProcessLaunchCommandTests.listDescriptorsAsync(command.executable, command.arguments);

    Assert.isTrue(direct.includes(ProcessLaunchCommandTests.INHERITED_DESCRIPTOR), `the program started directly inherits descriptor ${ProcessLaunchCommandTests.INHERITED_DESCRIPTOR}: ${direct.join(",")}`);
    Assert.areEqual("0,1,2,3", launched.join(","), "only the standard descriptors and the one ls opens itself remain");
  }

  @TestMethod
  public startsAProgramInsideAnAppImageThroughBashThatHoldsItsOwnCopy(): void {
    const environment = { APPIMAGE: "/home/ada/TeamRun.AppImage", APPDIR: "/tmp/.mount_TeamRuX" };
    const table = "98 29 0:62 / /tmp/.mount_TeamRuX ro,nosuid shared:51 - fuse.TeamRun.AppImage TeamRun.AppImage ro\n";
    const commands = [table, ""].map(t => {
      using _fileSystem = new FileSystemPatchFixture(null, t);
      return new ProcessLaunchCommand("linux", "/tmp/.mount_TeamRuX/teamrun", ["entry.js"], environment);
    });
    using _fileSystem = new FileSystemPatchFixture(null);
    const outside = new ProcessLaunchCommand("linux", "/opt/teamrun/teamrun", ["entry.js"], environment);

    const shown = commands.map(t => [t.executable, ...t.arguments.slice(0, 4), ...t.arguments.slice(5)].join("|"));
    Assert.areEqual(
      "/bin/bash|--noprofile|--norc|-p|-c|teamrun-launch|/home/ada/TeamRun.AppImage|/tmp/.mount_TeamRuX|mount|/tmp/.mount_TeamRuX/teamrun|entry.js",
      shown[0]);
    Assert.areEqual(
      "/bin/bash|--noprofile|--norc|-p|-c|teamrun-launch|/home/ada/TeamRun.AppImage|/tmp/.mount_TeamRuX|extract|/tmp/.mount_TeamRuX/teamrun|entry.js",
      shown[1]);
    Assert.areEqual(`${ProcessLaunchCommandTests.SHELL_ARGUMENTS}|/opt/teamrun/teamrun|entry.js`, outside.arguments.join("|"));
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async runsFromItsOwnMountAndEndsTheMountWithTheProgram(): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();

    const run = await ProcessLaunchCommandTests.runCopyAsync(fixture, true, { TEAMRUN_FIXTURE_EXIT: "3" });

    const [, holder = "", mounter = ""] = /^teamrun-copy mount (\d+) (\d+) (.+)$/m.exec(run.error) ?? [];
    const mount = path.join(fixture.folder, `mount-${mounter}`);
    Assert.areEqual(3, run.exitCode);
    Assert.areEqual(`teamrun-copy mount ${holder} ${mounter} ${fixture.image}\n`, run.error);
    Assert.areEqual(`${mount}/teamrun|entry.js|${mount}/resources/app.asar|--data-dir=/data|${mount}|`, await fixture.readRecordAsync());
    Assert.areEqual("", (await fixture.listMountsAsync()).join(","));
    Assert.areEqual("", (await fixture.listExtractionsAsync()).join(","));
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public runsFromItsOwnExtractionWhenTheAppImageCannotBeMounted(): Promise<void> {
    return ProcessLaunchCommandTests.runExtractedAsync(true);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public runsFromItsOwnExtractionWhenTheClientRanFromAnExtraction(): Promise<void> {
    return ProcessLaunchCommandTests.runExtractedAsync(false);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async failsWithTheReasonWhenTheAppImageCanBeNeitherMountedNorExtracted(): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();
    await fixture.refuseAsync("mount");
    await fixture.refuseAsync("extract");

    const run = await ProcessLaunchCommandTests.runCopyAsync(fixture, true);

    const [, holder = "", extraction = ""] = /^teamrun-copy extraction (\d+) (.+)$/m.exec(run.error) ?? [];
    Assert.areEqual(1, run.exitCode);
    Assert.areEqual(
      `${fixture.image} could not be mounted, so the runtime starts from an extraction of it.\nteamrun-copy extraction ${holder} ${extraction}\n`
      + `${fixture.image} could be neither mounted nor extracted, so the runtime cannot start.\n`,
      run.error);
    Assert.isFalse(existsSync(fixture.record));
    Assert.areEqual("", (await fixture.listExtractionsAsync()).join(","));
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async passesAnEndSignalToTheProgramAndThenEndsTheMount(): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();

    const run = await ProcessLaunchCommandTests.runCopyAsync(fixture, true, {}, ["wait"], "SIGTERM");

    Assert.areEqual(143, run.exitCode);
    Assert.areEqual("", (await fixture.listMountsAsync()).join(","));
  }

  private static async runExtractedAsync(isMounted: boolean): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();
    await fixture.refuseAsync("mount");

    const run = await ProcessLaunchCommandTests.runCopyAsync(fixture, isMounted);

    const [, holder = "", extraction = ""] = /^teamrun-copy extraction (\d+) (.+)$/m.exec(run.error) ?? [];
    const copy = path.join(extraction, "squashfs-root");
    const refused = isMounted ? `${fixture.image} could not be mounted, so the runtime starts from an extraction of it.\n` : "";
    Assert.areEqual(0, run.exitCode);
    Assert.areEqual(`${refused}teamrun-copy extraction ${holder} ${extraction}\n`, run.error);
    Assert.areEqual(fixture.temporary, path.dirname(extraction));
    Assert.isTrue(/^teamrun-runtime-[A-Za-z0-9]{6}$/.test(path.basename(extraction)), extraction);
    Assert.areEqual(`${copy}/teamrun|entry.js|${copy}/resources/app.asar|--data-dir=/data|${copy}|`, await fixture.readRecordAsync());
    Assert.areEqual("", (await fixture.listExtractionsAsync()).join(","));
  }

  private static runCopyAsync(fixture: AppImageFixture, isMounted: boolean, environment: NodeJS.ProcessEnv = {}, launchArguments: readonly string[] = [],
    signal: NodeJS.Signals | null = null): Promise<AppImageRun> {
    const table = isMounted ? `98 29 0:62 / ${fixture.root} ro,nosuid shared:51 - fuse.fixture fixture ro\n` : "";
    const command = ProcessLaunchCommandTests.createCopyCommand(fixture, table, launchArguments);
    return fixture.runAsync(command.executable, command.arguments, environment, signal);
  }

  private static createCopyCommand(fixture: AppImageFixture, table: string, launchArguments: readonly string[]): ProcessLaunchCommand {
    using _fileSystem = new FileSystemPatchFixture(null, table);
    const programArguments = launchArguments.length > 0 ? launchArguments : ["entry.js", path.join(fixture.root, "resources", "app.asar"), "--data-dir=/data"];
    return new ProcessLaunchCommand("linux", fixture.program, programArguments, { APPIMAGE: fixture.image, APPDIR: fixture.root });
  }

  private static async listDescriptorsAsync(executable: string, launchArguments: readonly string[]): Promise<number[]> {
    const stdio = Array.from({ length: ProcessLaunchCommandTests.INHERITED_DESCRIPTOR + 1 }, (_, index) => index === 1 || index === ProcessLaunchCommandTests.INHERITED_DESCRIPTOR ? "pipe" : "ignore");
    const child = spawn(executable, launchArguments, { stdio });
    let output = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => output += chunk);
    await once(child, "close");
    return output.trim().split(/\s+/).map(Number).sort((left, right) => left - right);
  }
}
