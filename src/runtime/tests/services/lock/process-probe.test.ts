/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessProbe } from "@noldova/teamrun-runtime";

@TestClass
export class ProcessProbeTests {
  @TestMethod
  public async tellsLiveProcessesFromDeadOnes(): Promise<void> {
    const probe = new ProcessProbe();
    const child = spawn(process.execPath, ["-e", "0"], { windowsHide: true, stdio: "ignore" });
    const processId = Number(child.pid);
    await new Promise(resolve => child.on("exit", resolve));

    Assert.isTrue(probe.isAlive(process.pid));
    Assert.isFalse(probe.isAlive(processId));
  }
}
