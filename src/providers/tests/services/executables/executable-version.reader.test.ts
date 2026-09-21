/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRunner, ExecutableVersionReader, ProcessCommand, ProcessTerminator } from "@noldova/teamrun-providers";

import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";

@TestClass
export class ExecutableVersionReaderTests {
  private static readonly reader: ExecutableVersionReader = new ExecutableVersionReader(new CommandRunner(new ProcessTerminator(process.platform)), 10_000);

  @TestMethod
  public async readsTheVersionNumber(): Promise<void> {
    const command = new ProcessCommand(process.execPath, [CodexTestHost.FAKE_SERVER_PATH]);

    Assert.areEqual("9.9.9", await ExecutableVersionReaderTests.reader.read(command, process.env));
  }

  @TestMethod
  public async reportsNullWithoutAVersionOrExecutable(): Promise<void> {
    const unversioned = new ProcessCommand(process.execPath, [ClaudeTestHost.FAKE_CLAUDE_PATH]);
    const missing = new ProcessCommand("teamrun-no-such-executable", []);

    Assert.isNull(await ExecutableVersionReaderTests.reader.read(unversioned, { ...process.env, TEAMRUN_FAKE_CLAUDE_VERSION: "unknown build" }));
    Assert.isNull(await ExecutableVersionReaderTests.reader.read(missing, process.env));
    Assert.throws(() => new ExecutableVersionReader(new CommandRunner(new ProcessTerminator("win32")), 0), ArgumentOutOfRangeException);
  }
}
