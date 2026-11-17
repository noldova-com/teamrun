/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessTerminator } from "@noldova/teamrun.providers";

@TestClass
export class ProcessTerminatorTests {
  private static readonly SLEEP_SCRIPT: string = "setTimeout(() => {}, 60000)";
  private static readonly COVERAGE_SCRIPT: string = "process.stdout.write(String(process.env.NODE_V8_COVERAGE))";

  @TestMethod
  public async attemptsWindowsTreeTerminationAndCleansUpIfUnavailable(): Promise<void> {
    const child = ProcessTerminatorTests.spawnSleeper();
    const exited = ProcessTerminatorTests.waitForExit(child);

    try {
      await new ProcessTerminator("win32").terminate(child);
      if (process.platform === "win32")
        Assert.isTrue(await exited);
    }
    finally {
      child.kill();
      Assert.isTrue(await exited);
    }
  }

  @TestMethod
  public async signalsTheChildElsewhere(): Promise<void> {
    const child = ProcessTerminatorTests.spawnSleeper();
    const exited = ProcessTerminatorTests.waitForExit(child);

    try {
      await new ProcessTerminator("linux").terminate(child);
      Assert.isTrue(await exited);
    }
    finally {
      child.kill();
      await exited;
    }
  }

  @TestMethod
  public async leavesFinishedAndUnstartedProcessesAlone(): Promise<void> {
    const finished = spawn(process.execPath, ["-e", "0"], { windowsHide: true });
    await ProcessTerminatorTests.waitForExit(finished);
    const unstarted = spawn("teamrun-no-such-executable", [], { windowsHide: true });
    const failed = new Promise<boolean>(resolve => unstarted.on("error", () => resolve(true)));

    await new ProcessTerminator("win32").terminate(finished);
    await new ProcessTerminator("win32").terminate(unstarted);

    Assert.isTrue(await failed);
    Assert.isUndefined(unstarted.pid);
  }

  @TestMethod
  public async startsTestChildrenWithoutACoverageFolderSoAKillCannotCutTheirReport(): Promise<void> {
    const child = spawn(process.execPath, ["-e", ProcessTerminatorTests.COVERAGE_SCRIPT], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let seen = "";
    child.stdout?.on("data", (chunk: Buffer) => seen += chunk.toString());
    await new Promise(resolve => child.once("close", resolve));

    Assert.areEqual("undefined", seen);
  }

  private static spawnSleeper(): ChildProcess {
    return spawn(process.execPath, ["-e", ProcessTerminatorTests.SLEEP_SCRIPT], { windowsHide: true, stdio: "ignore" });
  }

  private static waitForExit(child: ChildProcess): Promise<boolean> {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 5000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }
}
