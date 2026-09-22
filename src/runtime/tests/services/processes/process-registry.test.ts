/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessInspector, ProcessProbe, ProcessRegistry, TrackedProcess } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { VanishingProbe } from "../../fixtures/vanishing-probe.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class ProcessRegistryTests {
  @TestMethod
  public async endsTheLeftoversOfDeadRuntimesAndKeepsTheRest(): Promise<void> {
    using directory = new TemporaryDirectory();
    const probe = new ProcessProbe();
    const inspector = ProcessInspector.fromPlatform(process.platform);
    const path = directory.resolve("processes.json");
    const deadRuntime = ProcessRegistryTests.deadProcessId(probe);
    const leftover = ProcessRegistryTests.idle();
    const foreign = ProcessRegistryTests.idle();
    const current = ProcessRegistryTests.idle();
    try {
      const earlier = new ProcessRegistry(path, deadRuntime, probe, inspector);
      earlier.track(ProcessRegistryTests.pidOf(leftover), process.execPath);
      earlier.track(ProcessRegistryTests.pidOf(foreign), "C:\\somewhere\\codex.exe");
      earlier.track(deadRuntime + 1, process.execPath);
      earlier.track(0, process.execPath);
      const running = new ProcessRegistry(path, process.pid, probe, inspector);
      running.track(ProcessRegistryTests.pidOf(current), process.execPath);
      Assert.areEqual(4, ProcessRegistryTests.entries(path).length);

      const ended = new ProcessRegistry(path, process.pid, probe, inspector).reapLeftovers();
      await Wait.until(() => !probe.isAlive(ProcessRegistryTests.pidOf(leftover)));

      Assert.areEqual(String(ProcessRegistryTests.pidOf(leftover)), ended.join(","));
      Assert.isTrue(probe.isAlive(ProcessRegistryTests.pidOf(foreign)));
      Assert.isTrue(probe.isAlive(ProcessRegistryTests.pidOf(current)));
      Assert.areEqual(String(ProcessRegistryTests.pidOf(current)), ProcessRegistryTests.entries(path).map(t => t.processId).join(","));
      running.untrack(ProcessRegistryTests.pidOf(current));
      Assert.areEqual(0, ProcessRegistryTests.entries(path).length);
    }
    finally {
      leftover.kill();
      foreign.kill();
      current.kill();
    }
  }

  @TestMethod
  public toleratesAMissingOrMalformedFileAndAProcessThatVanishes(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("processes.json");
    const probe = new ProcessProbe();
    const inspector = new ProcessInspector(process.platform, () => "node.exe\n");
    const deadRuntime = ProcessRegistryTests.deadProcessId(probe);

    Assert.areEqual(0, new ProcessRegistry(path, process.pid, probe, inspector).reapLeftovers().length);
    writeFileSync(path, "{ not json");
    Assert.areEqual(0, new ProcessRegistry(path, process.pid, probe, inspector).reapLeftovers().length);
    writeFileSync(path, "{}");
    Assert.areEqual(0, new ProcessRegistry(path, process.pid, probe, inspector).reapLeftovers().length);
    writeFileSync(path, JSON.stringify([{ processId: "x" }, 5, { processId: deadRuntime + 2, executable: "node.exe", runtimeProcessId: deadRuntime }]));
    const vanished = new ProcessRegistry(path, process.pid, new VanishingProbe(deadRuntime), new ProcessInspector("win32", () => '"node.exe","1","Console","1","1 K"'));
    Assert.areEqual(0, vanished.reapLeftovers().length);
    Assert.isNull(TrackedProcess.fromJson({ processId: 1, executable: 2, runtimeProcessId: 3 }));
    Assert.isNull(TrackedProcess.fromJson([1]));
  }

  private static idle(): ChildProcess {
    return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
  }

  private static pidOf(child: ChildProcess): number {
    return child.pid ?? 0;
  }

  private static entries(path: string): TrackedProcess[] {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed.map(t => TrackedProcess.fromJson(t)).filter(t => t !== null) : [];
  }

  private static deadProcessId(probe: ProcessProbe): number {
    let candidate = 4_000_000;
    while (probe.isAlive(candidate))
      candidate -= 4;
    return candidate;
  }
}
