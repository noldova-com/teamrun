/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CodexAppServerProgram, type CodexServerChoice, CommandRunner, NodeProcessStarter, ProcessCommand, ProcessTerminator, Resources } from "@noldova/teamrun.providers";

import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { HeldAppServerDownload } from "../../fixtures/held-app-server-download.fixture.js";
import { ProgramRecorder } from "../../fixtures/program-recorder.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { StampedVersionReader } from "../../fixtures/stamped-version-reader.fixture.js";

class ProgramSetup {
  public readonly program: CodexAppServerProgram;
  public readonly download: HeldAppServerDownload;
  public readonly versionReader: StampedVersionReader;
  public readonly programs: ProgramRecorder;
  public readonly log: RecordingLog;

  public constructor(program: CodexAppServerProgram, download: HeldAppServerDownload, versionReader: StampedVersionReader, programs: ProgramRecorder,
    log: RecordingLog) {
    this.program = program;
    this.download = download;
    this.versionReader = versionReader;
    this.programs = programs;
    this.log = log;
  }
}

@TestClass
export class CodexAppServerProgramTests {
  private static readonly CODEX: ProcessCommand = new ProcessCommand(process.execPath, [CodexTestHost.FAKE_SERVER_PATH]);

  @TestMethod
  public async runsTheInstalledCodexsAppServerWithTheSourceWhenItsHelpNamesTheOptionWithoutReadingItsVersion(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    const choice = await setup.program.choose(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment({ TEAMRUN_FAKE_CODEX_SESSION_SOURCE: "true" }),
      new AbortController().signal);

    Assert.areEqual(`${process.execPath} app-server --session-source app-server`, CodexAppServerProgramTests.describe(choice));
    Assert.isNull(choice.download);
    Assert.areEqual(0, setup.versionReader.reads);
    Assert.areEqual(0, setup.download.fetched.length);
  }

  @TestMethod
  public async runsTheDownloadedAppServerOfTheInstalledVersionWithTheSourceWhenTheHelpLacksTheOption(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    setup.download.program = "/downloads/0.171.0/bin/codex-app-server";

    const choice = await setup.program.choose(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), new AbortController().signal);

    Assert.areEqual("/downloads/0.171.0/bin/codex-app-server --session-source app-server", CodexAppServerProgramTests.describe(choice));
    Assert.areEqual("/downloads/0.171.0/bin/codex-app-server", choice.download);
    Assert.areEqual(0, setup.download.fetched.length);
  }

  @TestMethod
  public async runsCodexAppServerWithoutStartingTheDownloadWhileItIsMissing(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();

    const choice = await setup.program.choose(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), new AbortController().signal);

    Assert.areEqual(`${process.execPath} app-server`, CodexAppServerProgramTests.describe(choice));
    Assert.isNull(choice.download);
    Assert.areEqual(0, setup.download.fetched.length);
  }

  @TestMethod
  public async noticesNothingWhenTheHelpNamesTheOptionAndDownloadsNothing(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();

    const notice = await setup.program.readNotice(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment({ TEAMRUN_FAKE_CODEX_SESSION_SOURCE: "true" }), true);

    Assert.isNull(notice);
    Assert.areEqual(0, setup.download.fetched.length);
  }

  @TestMethod
  public async noticesNothingOnceTheVersionsDownloadIsInPlace(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    setup.download.program = "/downloads/0.171.0/bin/codex-app-server";

    const notice = await setup.program.readNotice(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), true);

    Assert.isNull(notice);
    Assert.areEqual(0, setup.download.fetched.length);
  }

  @TestMethod
  public async startsTheVersionsDownloadWhenAskedToAndNoticesThatChatsShowUntilItIsInPlace(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();

    const notice = await setup.program.readNotice(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), true);

    Assert.areEqual(Resources.codexThreadsListedNotice, notice);
    Assert.areEqual("0.171.0", setup.download.fetched.join(","));
    Assert.isFalse(setup.download.signals[0]?.aborted ?? true);
  }

  @TestMethod
  public async downloadsNothingWhenNotAskedToAndNoticesThatChatsShow(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();

    const notice = await setup.program.readNotice(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), false);

    Assert.areEqual(Resources.codexThreadsListedNotice, notice);
    Assert.areEqual(0, setup.download.fetched.length);
  }

  @TestMethod
  public async noticesThatChatsShowWithoutDownloadingWhenTheVersionIsUnknownOrTheDownloadWasRefused(): Promise<void> {
    const unknown = CodexAppServerProgramTests.create();
    const refused = CodexAppServerProgramTests.create();
    refused.download.program = "/downloads/0.171.0/bin/codex-app-server";
    refused.program.refuse("/downloads/0.171.0/bin/codex-app-server", "it exited with code 3");

    const notices = [
      await unknown.program.readNotice(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment({ TEAMRUN_FAKE_CODEX_VERSION: "unknown" }), true),
      await refused.program.readNotice(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), true)
    ];

    Assert.areEqual(`${Resources.codexThreadsListedNotice}|${Resources.codexThreadsListedNotice}`, notices.join("|"));
    Assert.areEqual(0, unknown.download.fetched.length + refused.download.fetched.length);
  }

  @TestMethod
  public async stopsTheDownloadsItStartedWhenStopped(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    await setup.program.readNotice(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), true);

    setup.program.stop();

    Assert.isTrue(setup.download.signals[0]?.aborted ?? false);
  }

  @TestMethod
  public async treatsAHelpThatFailsAsLackingTheOption(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();

    const choice = await setup.program.choose(CodexAppServerProgramTests.CODEX,
      CodexAppServerProgramTests.environment({ TEAMRUN_FAKE_CODEX_SESSION_SOURCE: "true", TEAMRUN_FAKE_CODEX_HELP: "fails" }), new AbortController().signal);

    Assert.areEqual(`${process.execPath} app-server`, CodexAppServerProgramTests.describe(choice));
    Assert.areEqual(1, setup.versionReader.reads);
  }

  @TestMethod
  public async runsCodexAppServerOnceTheDownloadedProgramIsRefusedAndLogsWhy(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    setup.download.program = "/downloads/0.171.0/bin/codex-app-server";

    setup.program.refuse("/downloads/0.171.0/bin/codex-app-server", "it exited with code 3");
    const choice = await setup.program.choose(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), new AbortController().signal);

    Assert.areEqual(`${process.execPath} app-server`, CodexAppServerProgramTests.describe(choice));
    Assert.isNull(choice.download);
    Assert.areEqual("The downloaded Codex app server at /downloads/0.171.0/bin/codex-app-server didn't start, so TeamRun runs codex app-server instead, "
      + "and its Codex threads show in the Codex app: it exited with code 3", setup.log.lines.join("\n"));
  }

  @TestMethod
  public async readsTheHelpAndVersionOncePerStampOfTheCodexExecutable(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    const environment = CodexAppServerProgramTests.environment();

    await setup.program.choose(CodexAppServerProgramTests.CODEX, environment, new AbortController().signal);
    await setup.program.choose(CodexAppServerProgramTests.CODEX, environment, new AbortController().signal);
    const helpsBefore = setup.programs.started.length;
    const readsBefore = setup.versionReader.reads;
    setup.versionReader.stamp = "2";
    await setup.program.choose(CodexAppServerProgramTests.CODEX, environment, new AbortController().signal);

    Assert.areEqual("1 1", `${helpsBefore} ${readsBefore}`);
    Assert.areEqual("2 2", `${setup.programs.started.length} ${setup.versionReader.reads}`);
    Assert.areEqual("app-server --help", setup.programs.started.map(t => t.arguments.slice(1).join(" ")).at(-1));
  }

  @TestMethod
  public async readsAgainAfterAReadThatFoundNeitherTheOptionNorTheVersionAndRunsCodexAppServerMeanwhile(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();

    const first = await setup.program.choose(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment({ TEAMRUN_FAKE_CODEX_VERSION: "unknown" }),
      new AbortController().signal);
    const second = await setup.program.choose(CodexAppServerProgramTests.CODEX, CodexAppServerProgramTests.environment(), new AbortController().signal);

    Assert.areEqual(`${process.execPath} app-server`, CodexAppServerProgramTests.describe(first));
    Assert.areEqual(2, setup.programs.started.length);
    Assert.areEqual(`${process.execPath} app-server`, CodexAppServerProgramTests.describe(second));
    Assert.areEqual(2, setup.versionReader.reads);
  }

  @TestMethod
  public async readsEachTimeWhileTheCodexExecutableHasNoStamp(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    setup.versionReader.stamp = null;
    const environment = CodexAppServerProgramTests.environment({ TEAMRUN_FAKE_CODEX_SESSION_SOURCE: "true" });

    await setup.program.choose(CodexAppServerProgramTests.CODEX, environment, new AbortController().signal);
    await setup.program.choose(CodexAppServerProgramTests.CODEX, environment, new AbortController().signal);

    Assert.areEqual(2, setup.programs.started.length);
  }

  @TestMethod
  public async runsCodexAppServerWhenTheHelpCantStartAndReadsAgainNextTime(): Promise<void> {
    const setup = CodexAppServerProgramTests.create();
    const missing = new ProcessCommand(`${CodexTestHost.FAKE_SERVER_PATH}.missing`, []);

    const first = await setup.program.choose(missing, CodexAppServerProgramTests.environment(), new AbortController().signal);
    const second = await setup.program.choose(missing, CodexAppServerProgramTests.environment(), new AbortController().signal);

    Assert.areEqual(`${CodexTestHost.FAKE_SERVER_PATH}.missing app-server`, CodexAppServerProgramTests.describe(first));
    Assert.areEqual(`${CodexTestHost.FAKE_SERVER_PATH}.missing app-server`, CodexAppServerProgramTests.describe(second));
    Assert.areEqual(2, setup.versionReader.reads);
    Assert.areEqual(0, setup.download.fetched.length);
  }

  private static create(): ProgramSetup {
    const programs = new ProgramRecorder();
    const runner = new CommandRunner(programs.wrap(new NodeProcessStarter(new ProcessTerminator(process.platform))));
    const versionReader = new StampedVersionReader();
    const download = new HeldAppServerDownload();
    const log = new RecordingLog();
    return new ProgramSetup(new CodexAppServerProgram(runner, versionReader, download, 30_000, log), download, versionReader, programs, log);
  }

  private static environment(values: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
    return { ...process.env, TEAMRUN_FAKE_CODEX_VERSION: "0.171.0", ...values };
  }

  private static describe(choice: CodexServerChoice): string {
    return [choice.command.executable, ...choice.command.arguments.filter(t => t !== CodexTestHost.FAKE_SERVER_PATH)].join(" ");
  }
}
