/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliEntry } from "@noldova/teamrun-cli";
import { LockFile, ProcessProbe, RuntimeSettings } from "@noldova/teamrun-runtime";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class CliEntryTests {
  @TestMethod
  public async runsTheClientAsAProcess(): Promise<void> {
    using directory = new TemporaryDirectory();
    const dataDirectory = directory.resolve("data");
    const lock = new LockFile(RuntimeSettings.forPlatform(process.platform, dataDirectory, "0.0.0", null).lockPath, new ProcessProbe());
    const common = ["--data-dir", dataDirectory, "--runtime-providers", "none", "--idle-grace", "300"];

    const status = await CliEntryTests.execute(["status", "--data-dir", dataDirectory], "");
    const providers = await CliEntryTests.execute(["providers", "--json", ...common], "");
    const chat = await CliEntryTests.execute(["chat", "missing", "--provider", "fake", ...common], "hello\n");
    await Wait.until(() => lock.readLive() === null);

    Assert.areEqual(1, status.code);
    Assert.areEqual("No runtime is running for this data directory.", status.stdout.trim());
    Assert.areEqual(0, providers.code);
    Assert.areEqual("[]", providers.stdout.trim());
    Assert.areEqual(1, chat.code);
    Assert.isTrue(chat.stdout.includes("Type a message"));
    Assert.isTrue(chat.stderr.includes("Error (NotFound)"));
    Assert.isTrue(CliEntry.entryPath.endsWith("cli-entry.js"));
  }

  private static execute(args: readonly string[], input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise(resolve => {
      const child = spawn(process.execPath, [CliEntry.entryPath, ...args], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => stdout += chunk);
      child.stderr.on("data", (chunk: string) => stderr += chunk);
      child.on("close", code => resolve({ code, stdout, stderr }));
      child.stdin.end(input);
    });
  }
}
