/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { basename } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessInspector } from "@noldova/teamrun-runtime";

@TestClass
export class ProcessInspectorTests {
  @TestMethod
  public namesTheImageOnWindowsAndTheCommandElsewhere(): void {
    const calls: string[] = [];
    const windows = new ProcessInspector("win32", (executable, args) => {
      calls.push(`${executable} ${args.join(" ")}`);
      return '"codex.exe","1234","Console","1","12,345 K"\r\n';
    });
    const noTask = new ProcessInspector("win32", () => "INFO: No tasks are running which match the specified criteria.");
    const linux = new ProcessInspector("linux", (executable, args) => { calls.push(`${executable} ${args.join(" ")}`); return "/opt/provider/codex\n"; });
    const mac = new ProcessInspector("darwin", (executable, args) => { calls.push(`${executable} ${args.join(" ")}`); return "/opt/provider/codex\n"; });
    const gone = new ProcessInspector("linux", () => "\n");
    const failing = new ProcessInspector("linux", () => { throw new Error("no ps"); });

    Assert.areEqual("codex.exe", windows.imageOf(1234));
    Assert.isNull(noTask.imageOf(1234));
    Assert.areEqual("codex", linux.imageOf(1234));
    Assert.areEqual("codex", mac.imageOf(1234));
    Assert.isNull(gone.imageOf(1234));
    Assert.isNull(failing.imageOf(1234));
    Assert.areEqual("tasklist /FI PID eq 1234 /FO CSV /NH,readlink /proc/1234/exe,ps -p 1234 -o comm=", calls.join(","));
  }

  @TestMethod
  public namesThisProcessThroughThePlatformCommand(): void {
    const inspector = ProcessInspector.fromPlatform(process.platform);

    const image = inspector.imageOf(process.pid);

    Assert.areEqual(basename(process.execPath).toLowerCase(), (image ?? "").toLowerCase());
  }
}
