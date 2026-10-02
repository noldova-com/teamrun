/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { LaunchException, ProcessLaunchCommand } from "@noldova/teamrun-shell-runtime";

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

  private static async listDescriptorsAsync(executable: string, launchArguments: readonly string[]): Promise<number[]> {
    const stdio = Array.from({ length: ProcessLaunchCommandTests.INHERITED_DESCRIPTOR + 1 }, (_, index) => index === 1 || index === ProcessLaunchCommandTests.INHERITED_DESCRIPTOR ? "pipe" : "ignore");
    const child = spawn(executable, launchArguments, { stdio });
    let output = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => output += chunk);
    await once(child, "close");
    return output.trim().split(/\s+/).map(Number).sort((left, right) => left - right);
  }
}
