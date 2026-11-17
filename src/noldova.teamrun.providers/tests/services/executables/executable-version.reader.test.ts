/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, writeFileSync } from "node:fs";

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRunner, ExecutableVersionReader, NodeProcessStarter, ProcessCommand, ProcessTerminator } from "@noldova/teamrun.providers";

import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ExecutableVersionReaderTests {
  private static readonly reader: ExecutableVersionReader = new ExecutableVersionReader(new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))), 10_000);

  @TestMethod
  public async readsTheVersionNumber(): Promise<void> {
    const command = new ProcessCommand(process.execPath, [CodexTestHost.FAKE_SERVER_PATH]);

    Assert.areEqual("9.9.9", await ExecutableVersionReaderTests.reader.read(command, process.env));
    Assert.areEqual("0.154.0-alpha.2", await ExecutableVersionReaderTests.reader.read(command, { ...process.env, TEAMRUN_FAKE_CODEX_VERSION: "0.154.0-alpha.2" }));
  }

  @TestMethod
  public async reportsNullWithoutAVersionOrExecutable(): Promise<void> {
    const unversioned = new ProcessCommand(process.execPath, [ClaudeTestHost.FAKE_CLAUDE_PATH]);
    const missing = new ProcessCommand("teamrun-no-such-executable", []);

    Assert.isNull(await ExecutableVersionReaderTests.reader.read(unversioned, { ...process.env, TEAMRUN_FAKE_CLAUDE_VERSION: "unknown build" }));
    Assert.isNull(await ExecutableVersionReaderTests.reader.read(missing, process.env));
    Assert.throws(() => new ExecutableVersionReader(new CommandRunner(new NodeProcessStarter(new ProcessTerminator("win32"))), 0), ArgumentOutOfRangeException);
  }

  @TestMethod
  public async reportsNullForAVersionInTheOutputOfACommandThatExitsOtherwiseThanZero(): Promise<void> {
    using directory = new TemporaryDirectory();
    const failing = directory.resolve("failing.cjs");
    writeFileSync(failing, `console.log("error: \\"/versions/2.1.310\\" is truncated"); process.exit(1);`);

    Assert.isNull(await ExecutableVersionReaderTests.reader.read(new ProcessCommand(process.execPath, [failing]), process.env));
  }

  @TestMethod
  public stampsTheExecutableAnewOnceItIsReplacedAndNullWhenItIsMissing(): void {
    using directory = new TemporaryDirectory();
    const command = new ProcessCommand(directory.resolve("codex"), []);
    writeFileSync(command.executable, "old");
    const first = ExecutableVersionReaderTests.reader.readStamp(command);
    const same = ExecutableVersionReaderTests.reader.readStamp(command);
    appendFileSync(command.executable, " and new");
    const replaced = ExecutableVersionReaderTests.reader.readStamp(command);

    Assert.areEqual(first, same);
    Assert.areNotEqual(first, replaced);
    Assert.isNull(ExecutableVersionReaderTests.reader.readStamp(new ProcessCommand(directory.resolve("missing"), [])));
  }
}
