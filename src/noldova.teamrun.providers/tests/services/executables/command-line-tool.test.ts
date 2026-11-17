/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  CommandLineTool,
  CommandRunner,
  ExecutableSource,
  ExecutableVersionReader,
  LocatedExecutable,
  NodeProcessStarter,
  ProcessTerminator,
  Resources
} from "@noldova/teamrun.providers";

import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";

@TestClass
export class CommandLineToolTests {
  private static readonly reader: ExecutableVersionReader = new ExecutableVersionReader(new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))), 10_000);
  private static readonly install: string = "npm install -g @openai/codex";
  private static readonly page: string = "https://chatgpt.com/pricing";

  @TestMethod
  public async findsTheToolAndItsVersionWithTheInstallCommandAndPage(): Promise<void> {
    const located = new LocatedExecutable(process.execPath, ExecutableSource.Path, [CodexTestHost.FAKE_SERVER_PATH]);
    const tool = new CommandLineTool("codex", () => located, CommandLineToolTests.reader, process.env, CommandLineToolTests.install, CommandLineToolTests.page);

    Assert.areEqual(JSON.stringify({ kind: "codex", found: true, version: "9.9.9", installCommand: CommandLineToolTests.install, subscribeUrl: CommandLineToolTests.page }),
      JSON.stringify((await tool.check()).toJson()));
  }

  @TestMethod
  public async looksAfreshEachTimeSoAToolInstalledSinceIsFound(): Promise<void> {
    let located: LocatedExecutable | null = null;
    let looks = 0;
    const tool = new CommandLineTool("codex", () => {
      looks++;
      return located;
    }, CommandLineToolTests.reader, process.env, CommandLineToolTests.install, null);

    const before = await tool.check();
    located = new LocatedExecutable(process.execPath, ExecutableSource.LocalBin, [CodexTestHost.FAKE_SERVER_PATH]);
    const after = await tool.check();

    Assert.areEqual("false null true 9.9.9 2", `${before.found} ${before.version} ${after.found} ${after.version} ${looks}`);
    Assert.areEqual(CommandLineToolTests.install, before.installCommand);
    Assert.isNull(after.subscribeUrl);
  }

  @TestMethod
  public async reportsAToolThatGivesNoVersionAsFoundWithoutOne(): Promise<void> {
    const located = new LocatedExecutable(process.execPath, ExecutableSource.Path, [ClaudeTestHost.FAKE_CLAUDE_PATH]);
    const tool = new CommandLineTool("claude", () => located, CommandLineToolTests.reader, { ...process.env, TEAMRUN_FAKE_CLAUDE_VERSION: "unknown build" }, null, null);

    const checked = await tool.check();

    Assert.areEqual("true null", `${checked.found} ${checked.version}`);
    Assert.throws(() => new CommandLineTool(" ", () => null, CommandLineToolTests.reader, process.env, null, null), ArgumentException);
  }

  @TestMethod
  public choosesTheWindowsInstallCommandOnWindowsAndThePosixOneElsewhere(): void {
    Assert.areEqual("winget,curl,curl", ["win32", "darwin", "linux"].map(t => CommandLineTool.installCommandFor(t, "curl", "winget")).join(","));
    Assert.isNull(CommandLineTool.installCommandFor("win32", "curl", null));
    Assert.areEqual("curl", CommandLineTool.installCommandFor("linux", "curl", null));
  }

  @TestMethod
  public installsOpencodeAndPiOnLinuxAndMacOsWithTheirVendorsHomeFolderInstallersAndNeverIntoNpmsGlobalFolder(): void {
    const kinds: readonly (readonly [string, string])[] = [[Resources.opencodePosixInstallCommand, Resources.opencodeWindowsInstallCommand], [Resources.piPosixInstallCommand, Resources.piWindowsInstallCommand]];
    const commands = (platform: string): (string | null)[] => kinds.map(([posix, windows]) => CommandLineTool.installCommandFor(platform, posix, windows));
    const homeInstallers = ["curl -fsSL https://opencode.ai/install | bash", "curl -fsSL https://pi.dev/install.sh | sh"].join("|");

    Assert.areEqual(homeInstallers, commands("linux").join("|"));
    Assert.areEqual(homeInstallers, commands("darwin").join("|"));
    Assert.areEqual("false,false,false,false", [...commands("linux"), ...commands("darwin")].map(t => /\b(?:npm|sudo)\b/u.test(t ?? "npm")).join(","));
    Assert.areEqual(["npm i -g opencode-ai@1", "npm i -g @earendil-works/pi-coding-agent"].join("|"), commands("win32").join("|"));
  }
}
