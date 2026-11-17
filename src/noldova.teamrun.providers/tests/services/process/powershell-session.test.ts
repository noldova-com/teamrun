/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, Category, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { TimeoutException } from "@noldova/teamrun.core";
import { PowershellSession, Resources } from "@noldova/teamrun.providers";

import { FakePowershell } from "../../fixtures/fake-powershell.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class PowershellSessionTests {
  private static readonly LIMIT: number = 30_000;

  @TestMethod
  public async runsEachScriptInTurnInOneShellOnItsEnvironmentAndAnswersWithWhatTheScriptWrote(): Promise<void> {
    using directory = new TemporaryDirectory();
    const session = new PowershellSession(process.execPath, [FakePowershell.create(directory.path)], { ...process.env, TEAMRUN_SESSION_VALUE: "value" }, 1);

    const answers = await Promise.all(["pid", "'quoted'", "env TEAMRUN_SESSION_VALUE", "noise", "many", "pid", "Get-Thing"]
      .map(t => session.run(t, PowershellSessionTests.LIMIT)));
    await Wait.until(() => !PowershellSessionTests.runs(Number(answers[0])), "The shell's process still ran.");

    const line = Resources.lineSeparator;
    const many = Array.from({ length: 20_000 }, (_, index) => `line ${String(index)}${line}`).join("");
    Assert.areEqual(JSON.stringify([answers[0], `quoted${line}`, `value${line}`, "", many, answers[0], `ran Get-Thing${line}`]), JSON.stringify(answers));
    Assert.isTrue(Number(answers[0]) > 0);
  }

  @TestMethod
  public async closesItsShellOnceIdleAndStartsANewOneForTheNextScript(): Promise<void> {
    using directory = new TemporaryDirectory();
    const session = new PowershellSession(process.execPath, [FakePowershell.create(directory.path)], process.env, 1);

    const first = Number(await session.run("pid", PowershellSessionTests.LIMIT));
    await Wait.until(() => !PowershellSessionTests.runs(first), "The first process still ran.");
    const second = Number(await session.run("pid", PowershellSessionTests.LIMIT));
    await Wait.until(() => !PowershellSessionTests.runs(second), "The second process still ran.");

    Assert.areNotEqual(first, second);
  }

  @TestMethod
  public async endsTheShellOfAScriptThatRunsOutOfTimeAndRunsTheNextScriptInANewShell(): Promise<void> {
    using directory = new TemporaryDirectory();
    const session = new PowershellSession(process.execPath, [FakePowershell.create(directory.path)], process.env, 1);
    const first = Number(await session.run("pid", PowershellSessionTests.LIMIT));

    const hung = session.run("hang", 50);
    const next = session.run("pid", PowershellSessionTests.LIMIT);
    const failure = await Assert.throwsAsync(() => hung, TimeoutException);
    const second = Number(await next);
    await Wait.until(() => !PowershellSessionTests.runs(first), "The first process still ran.");
    await Wait.until(() => !PowershellSessionTests.runs(second), "The second process still ran.");

    Assert.areEqual(Resources.formatPowershellSessionTimedOut(50), failure.message);
    Assert.areNotEqual(first, second);
  }

  @TestMethod
  public async failsAQueuedScriptWhoseTimeRanOutWhileItWaitedWithoutRunningIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const session = new PowershellSession(process.execPath, [FakePowershell.create(directory.path)], process.env, 1);
    const first = Number(await session.run("pid", PowershellSessionTests.LIMIT));

    const hung = session.run("hang", 50);
    const queued = session.run("pid", 20);
    const failures = await Promise.all([Assert.throwsAsync(() => hung, TimeoutException), Assert.throwsAsync(() => queued, TimeoutException)]);
    const second = Number(await session.run("pid", PowershellSessionTests.LIMIT));
    await Wait.until(() => !PowershellSessionTests.runs(first), "The first process still ran.");
    await Wait.until(() => !PowershellSessionTests.runs(second), "The second process still ran.");

    Assert.areEqual(JSON.stringify([Resources.formatPowershellSessionTimedOut(50), Resources.formatPowershellSessionTimedOut(20)]),
      JSON.stringify(failures.map(t => t.message)));
    Assert.areNotEqual(first, second);
  }

  @TestMethod
  public async failsAScriptWhoseShellEndsBeforeAnsweringAndRunsTheNextScriptInANewShell(): Promise<void> {
    using directory = new TemporaryDirectory();
    const session = new PowershellSession(process.execPath, [FakePowershell.create(directory.path)], process.env, 1);
    const first = Number(await session.run("pid", PowershellSessionTests.LIMIT));

    const failure = await Assert.throwsAsync(() => session.run("exit", PowershellSessionTests.LIMIT), Error);
    const second = Number(await session.run("pid", PowershellSessionTests.LIMIT));
    await Wait.until(() => !PowershellSessionTests.runs(first), "The first process still ran.");
    await Wait.until(() => !PowershellSessionTests.runs(second), "The second process still ran.");

    Assert.areEqual(Resources.powershellSessionEnded, failure.message);
    Assert.areNotEqual(first, second);
  }

  @TestMethod
  public async failsEachScriptWithTheStartFailureWhileTheShellCannotStart(): Promise<void> {
    using directory = new TemporaryDirectory();
    const session = new PowershellSession(directory.resolve("missing-shell"), [], process.env, 1);

    const failures = [await Assert.throwsAsync(() => session.run("pid", PowershellSessionTests.LIMIT), Error),
      await Assert.throwsAsync(() => session.run("pid", PowershellSessionTests.LIMIT), Error)];

    Assert.areEqual(JSON.stringify(["ENOENT", "ENOENT"]), JSON.stringify(failures.map(t => (t as NodeJS.ErrnoException).code)));
  }

  @Category("ProcessListing")
  @TestMethod
  public async listsThisProcessUnderItsParentWithTheStartWindowsManagementGivesAndKeepsAnsweringAfterAFailedScriptOnWindows(): Promise<void> {
    if (process.platform !== Resources.windowsPlatform)
      return;
    const session = new PowershellSession(Resources.powershellExecutable, Resources.powershellSessionArguments, process.env, 1);

    const answers = [await session.run(Resources.powershellProcessListScript, Resources.processListTimeout),
      await session.run("throw 'refused'", Resources.processListTimeout), await session.run(Resources.powershellCimProcessListScript, Resources.processListTimeout)];

    const entries = answers.map(t => [...t.matchAll(Resources.processParentPattern)].find(u => Number(u[1]) === process.pid)?.slice(2, 4));
    Assert.areEqual(String(process.ppid), entries[0]?.[0]);
    Assert.isTrue(Number(entries[0]?.[1]) > 0);
    Assert.areEqual(JSON.stringify([entries[0], undefined, entries[0]]), JSON.stringify(entries));
  }

  @Category("ProcessListing")
  @TestMethod
  @TestData("throw new System.InvalidOperationException();")
  @TestData(`return "";`)
  public async listsThisProcessThroughWindowsManagementWhenItsTypeFailsOrListsNothingOnWindows(body: string): Promise<void> {
    if (process.platform !== Resources.windowsPlatform)
      return;
    const session = new PowershellSession(Resources.powershellExecutable, Resources.powershellSessionArguments, process.env, 1);

    await session.run(`Add-Type -TypeDefinition 'public static class ${Resources.powershellProcessListType} { public static string List() { ${body} } }'`,
      Resources.processListTimeout);
    const answers = [await session.run(Resources.powershellProcessListScript, Resources.processListTimeout),
      await session.run(Resources.powershellCimProcessListScript, Resources.processListTimeout)];

    const entries = answers.map(t => [...t.matchAll(Resources.processParentPattern)].find(u => Number(u[1]) === process.pid)?.slice(2, 4));
    Assert.areEqual(String(process.ppid), entries[0]?.[0]);
    Assert.areEqual(JSON.stringify([entries[1], entries[1]]), JSON.stringify(entries));
  }

  @Category("ProcessListing")
  @TestMethod
  public async endsItsPowershellOnceIdleOnWindows(): Promise<void> {
    if (process.platform !== Resources.windowsPlatform)
      return;
    const session = new PowershellSession(Resources.powershellExecutable, Resources.powershellSessionArguments, process.env, 1);

    const shell = Number(await session.run("$PID", Resources.processListTimeout));
    await Wait.until(() => !PowershellSessionTests.runs(shell), "The shell still ran.");

    Assert.isTrue(shell > 0);
  }

  private static runs(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }
}
