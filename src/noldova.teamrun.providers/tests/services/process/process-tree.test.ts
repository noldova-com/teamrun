/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, Category, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { type ITimer, NodeTimer, TimeoutException } from "@noldova/teamrun.core";
import { CommandRunner, type IPowershellSession, NodeProcessStarter, PowershellSession, ProcessCommand, ProcessTerminator, ProcessTree, Resources } from "@noldova/teamrun.providers";

import { FakeTaskTree, type FakeTaskTreeMode } from "../../fixtures/fake-task-tree.fixture.js";
import { HeldDelayTimer } from "../../fixtures/held-delay-timer.fixture.js";
import { ListingCommandRunner } from "../../fixtures/listing-command-runner.fixture.js";
import { ListingPowershellSession } from "../../fixtures/listing-powershell-session.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class ProcessTreeTests {
  private static readonly DAYS: readonly string[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  private static readonly MONTHS: readonly string[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  private static readonly GONE: number = 2_147_483_644;
  private static readonly ANCESTOR: number = 999;

  @Category("ProcessListing")
  @TestMethod
  public async endsATreeWhoseParentStartsItsNextProcessWhenOneEndsAndLeavesNoneOfItRunning(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("tree.txt");
    FakeTaskTree.start(path, 1, "sequence");
    try {
      await Wait.until(() => FakeTaskTree.read(path).length === 2, "The task tree did not get both processes.");
      const [root, child] = FakeTaskTree.read(path) as [number, number];

      const ended = await ProcessTreeTests.tree(process.platform, new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))))
        .endTree(root, Date.now(), process.pid);
      await Wait.until(() => !ProcessTreeTests.runs(root), "The root process still ran.");
      await Wait.until(() => !ProcessTreeTests.runs(child), "The child process still ran.");
      await Wait.delay(300);

      Assert.isTrue(ended);
      Assert.areEqual(JSON.stringify([root, child]), JSON.stringify(FakeTaskTree.read(path)));
    }
    finally {
      FakeTaskTree.endAll(path);
    }
  }

  @TestMethod
  @TestData("linux")
  @TestData("win32")
  public async refusesAProcessThatIsNoLongerTheOneTeamRunLearnedOfAndEndsNothing(platform: string): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("tree.txt");
    const [task] = await ProcessTreeTests.start(path, "follow") as [number];
    const ancestor = process.pid;
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const cases = [
      { listing: [[ancestor, 1, start], [task, ancestor, start + 30_000]], startedBy: start + 10_000 },
      { listing: [[ancestor, 1, start], [ProcessTreeTests.GONE, ancestor, start + 20_000], [task, ProcessTreeTests.GONE, start + 10_000]], startedBy: start + 30_000 },
      { listing: [[ancestor, 1, start], [task, ProcessTreeTests.GONE, start + 10_000]], startedBy: start + 30_000 },
      { listing: [[ancestor, 1, start], [ProcessTreeTests.GONE, task, start + 10_000], [task, ProcessTreeTests.GONE, start + 10_000]], startedBy: start + 30_000 }
    ];

    try {
      const results: [boolean, number][] = [];
      for (const each of cases) {
        const runner = new ListingCommandRunner([ProcessTreeTests.listing(platform, each.listing)]);
        results.push([await ProcessTreeTests.tree(platform, runner).endTree(task, each.startedBy, ancestor), runner.calls]);
      }
      await Wait.delay(200);

      Assert.areEqual(JSON.stringify(cases.map(() => [false, 1])), JSON.stringify(results));
      Assert.isTrue(ProcessTreeTests.runs(task));
    }
    finally {
      FakeTaskTree.endAll(path);
    }
  }

  @TestMethod
  public async endsTheTreeOnWindowsInRoundsParentsFirstAndNotThroughAParentIdAnotherProcessHoldsNow(): Promise<void> {
    const start = Date.now() - 60_000;
    const [root, child, stale, late, impostorChild] = [1001, 1002, 1003, 1004, 1005];
    const first = [[ProcessTreeTests.ANCESTOR, 1, start], [root, ProcessTreeTests.ANCESTOR, start + 10_000], [child, root, start + 20_000], [stale, child, start + 15_000]];
    const next = [[ProcessTreeTests.ANCESTOR, 1, start], [root, ProcessTreeTests.ANCESTOR, start + 50_000], [impostorChild, root, start + 55_000], [late, child, start + 30_000]];
    const gone = [[ProcessTreeTests.ANCESTOR, 1, start], [root, ProcessTreeTests.ANCESTOR, start + 50_000], [impostorChild, root, start + 55_000]];
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("win32", first), ProcessTreeTests.listing("win32", next), ProcessTreeTests.listing("win32", gone)]);

    const ended = await ProcessTreeTests.tree("win32", runner).endTree(root, Date.now(), ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(3, runner.calls);
    Assert.isTrue(runner.commands.every(t => t.executable === "powershell.exe"));
    const deadline = `$deadline = [DateTime]::UtcNow.AddMilliseconds(${String(Resources.processExitWait)}); `;
    Assert.areEqual(JSON.stringify([`$ids = @(${String(root)}, ${String(child)}); $starts = @(${String(start + 10_000)}, ${String(start + 20_000)}); ${deadline}`,
      `$ids = @(${String(late)}); $starts = @(${String(start + 30_000)}); ${deadline}`]),
      JSON.stringify(runner.commands.slice(1).map(t => t.arguments.at(-1)!.slice(0, t.arguments.at(-1)!.indexOf("for (")))));
  }

  @TestMethod
  public async endsATreeItStartedUnderAnyParentButNotAProcessThatStartedLaterOrIsGone(): Promise<void> {
    const start = Date.now() - 60_000;
    const [own, child] = [1001, 1002];
    const listing = [[ProcessTreeTests.ANCESTOR, 1, start], [own, ProcessTreeTests.GONE, start + 10_000], [child, own, start + 20_000]];
    const cases: readonly (readonly [number, number])[] = [[own, start + 30_000], [own, start + 5_000], [ProcessTreeTests.GONE, start + 30_000]];
    const results: [boolean, boolean][] = [];
    for (const [processId, startedBy] of cases) {
      const runner = new ListingCommandRunner([ProcessTreeTests.listing("win32", listing), ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start]])]);
      const ended = await ProcessTreeTests.tree("win32", runner).endOwnTree(processId, startedBy);
      results.push([ended, runner.commands.slice(1).some(t => t.arguments.at(-1)?.startsWith(`$ids = @(${String(own)}, ${String(child)}); `) === true)]);
    }

    Assert.areEqual(JSON.stringify([[true, true], [false, false], [false, false]]), JSON.stringify(results));
  }

  @TestMethod
  public async stopsEndingTheTreeOnWindowsWhenARoundCannotRun(): Promise<void> {
    const start = Date.now() - 60_000;
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start], [1001, ProcessTreeTests.ANCESTOR, start + 10_000]]), null]);

    const ended = await ProcessTreeTests.tree("win32", runner).endTree(1001, Date.now(), ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(2, runner.calls);
  }

  @Category("ProcessListing")
  @TestMethod
  public async endsOnWindowsOnlyAProcessThatStartedWhenTheListingSaid(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("tree.txt");
    const [replaced, child] = await ProcessTreeTests.start(path, "stay", "stay") as [number, number];
    try {
      const real = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));
      const starts = await ProcessTreeTests.startsOf(real);
      const childStart = starts.get(child) ?? Date.now();
      const runner = new ListingCommandRunner([ProcessTreeTests.listing("win32",
        [[process.pid, 1, 0], [replaced, process.pid, childStart - 60_000], [child, replaced, childStart]])], real);

      const ended = await ProcessTreeTests.tree("win32", runner).endTree(replaced, Date.now(), process.pid);
      if (process.platform === "win32")
        await Wait.until(() => !ProcessTreeTests.runs(child), "The child process still ran.");
      await Wait.delay(200);

      Assert.isTrue(ended);
      Assert.isTrue(ProcessTreeTests.runs(replaced));
      Assert.areEqual(process.platform !== "win32", ProcessTreeTests.runs(child));
    }
    finally {
      FakeTaskTree.endAll(path);
    }
  }

  @TestMethod
  public async holdsTheTreeStillOutsideWindowsUntilNoNewProcessShowsAndHoldsItAgainToKillWhatOutlivesTheGrace(): Promise<void> {
    const [root, child, late, gone] = [2001, 2002, 2003, ProcessTreeTests.GONE];
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const first = [[ProcessTreeTests.ANCESTOR, 1, start], [root, ProcessTreeTests.ANCESTOR, start + 10_000], [child, root, start + 20_000]];
    const grown = [...first, [gone, child, start + 30_000]];
    const after = [...first, [gone, child, start + 40_000], [late, child, start + 45_000]];
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("linux", first), ProcessTreeTests.listing("linux", grown),
      ProcessTreeTests.listing("linux", grown), ProcessTreeTests.listing("linux", after)]);
    const signals = ProcessTreeTests.signals([root, child, late]);

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill).endTree(root, Date.now(), ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(5, runner.calls);
    Assert.isTrue(runner.commands.every(t => t.executable === "ps"));
    Assert.areEqual(JSON.stringify([
      `${String(root)} SIGSTOP`, `${String(child)} SIGSTOP`, `${String(root)} SIGTERM`, `${String(child)} SIGTERM`, `${String(root)} SIGCONT`, `${String(child)} SIGCONT`,
      `${String(root)} SIGSTOP`, `${String(child)} SIGSTOP`, `${String(late)} SIGSTOP`, `${String(root)} SIGKILL`, `${String(child)} SIGKILL`, `${String(late)} SIGKILL`
    ]), JSON.stringify(signals.sent));
  }

  @Category("ProcessListing")
  @TestMethod
  public async endsTheGraceOnceTheTreeIsGone(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("tree.txt");
    FakeTaskTree.start(path, 2);
    await Wait.until(() => FakeTaskTree.read(path).length === 2, "The task tree did not get both processes.");
    const [root, child] = FakeTaskTree.read(path) as [number, number];
    const runner = new ListingCommandRunner([], new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))));
    const delays: number[] = [];
    const real = new NodeTimer();
    const timer: ITimer = {
      now: () => real.now(),
      delayAsync: (milliseconds, signal) => {
        delays.push(milliseconds);
        return real.delayAsync(milliseconds, signal);
      }
    };
    const grace = 60_000;
    const tree = new ProcessTree(process.platform, runner, process.env, Resources.processListTimeout, timer, grace);

    const ended = await tree.endTree(root, Date.now(), process.pid);
    const last = runner.outputs.at(-1) ?? "";
    const left = [root, child].filter(t => ProcessTreeTests.runs(t))
      .map(t => `${String(t)} ${last.split("\n").some(line => line.trim().split(" ")[0] === String(t)) ? "listed" : "not listed"}`);

    const rounds = runner.commands.map(t => t.arguments.at(-1) ?? "").filter(t => t.startsWith("$ids = "));
    Assert.isTrue(ended);
    Assert.areEqual("[]", JSON.stringify(left));
    Assert.isTrue(rounds.length < Resources.processTreeFreezeRounds, JSON.stringify(rounds));
    Assert.isTrue(delays.reduce((total, delay) => total + delay, 0) < grace, JSON.stringify(delays.length));
    Assert.isTrue(runner.timeouts.length > 0 && runner.timeouts.every(t => t === Resources.processListTimeout), JSON.stringify(runner.timeouts));
  }

  @TestMethod
  public async stopsListingATreeThatKeepsGrowingAndSignalsNothingThatHadAlreadyEnded(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const listings = Array.from({ length: 12 }, (_, index) => ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start],
      [ProcessTreeTests.GONE, ProcessTreeTests.ANCESTOR, start + 10_000],
      ...Array.from({ length: index }, (_, t) => [ProcessTreeTests.GONE - 1 - t, ProcessTreeTests.GONE, start + 20_000])]));
    const runner = new ListingCommandRunner(listings);
    const signals = ProcessTreeTests.signals([]);

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill).endTree(ProcessTreeTests.GONE, Date.now(), ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(12, runner.calls);
    Assert.areEqual(0, signals.sent.length);
  }

  @TestMethod
  public async signalsThroughProcessKillByDefaultAndSkipsAProcessThatHasEnded(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("linux",
      [[ProcessTreeTests.ANCESTOR, 1, start], [ProcessTreeTests.GONE, ProcessTreeTests.ANCESTOR, start + 10_000]])]);

    const ended = await ProcessTreeTests.tree("linux", runner).endTree(ProcessTreeTests.GONE, Date.now(), ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(3, runner.calls);
  }

  @TestMethod
  public async endsWhatItHeldWhenTheProcessesCanNoLongerBeListed(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const root = 2001;
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [root, ProcessTreeTests.ANCESTOR, start + 10_000]]), null]);
    const signals = ProcessTreeTests.signals([root]);

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill).endTree(root, Date.now(), ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(3, runner.calls);
    Assert.areEqual(JSON.stringify([`${String(root)} SIGSTOP`, `${String(root)} SIGTERM`, `${String(root)} SIGCONT`]), JSON.stringify(signals.sent));
  }

  @TestMethod
  public async endsEveryProcessUnderARunningProcessOutsideWindowsButThatProcessItself(): Promise<void> {
    const [root, child, grandchild] = [2001, 2002, 2003];
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const listing = ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [root, ProcessTreeTests.ANCESTOR, start + 10_000], [child, root, start + 20_000],
      [grandchild, child, start + 30_000]]);
    const runner = new ListingCommandRunner([listing, listing,
      ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [root, ProcessTreeTests.ANCESTOR, start + 10_000]])]);
    const signals = ProcessTreeTests.signals([root, child, grandchild]);

    await ProcessTreeTests.tree("linux", runner, signals.kill).endDescendants(root);

    Assert.areEqual(JSON.stringify([`${String(child)} SIGSTOP`, `${String(grandchild)} SIGSTOP`, `${String(child)} SIGTERM`, `${String(grandchild)} SIGTERM`,
      `${String(child)} SIGCONT`, `${String(grandchild)} SIGCONT`]), JSON.stringify(signals.sent));
  }

  @TestMethod
  public async endsATreeItStartedUnderAnyParentOutsideWindows(): Promise<void> {
    const [own, child] = [2001, 2002];
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const listing = ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [own, ProcessTreeTests.GONE, start + 10_000], [child, own, start + 20_000]]);
    const runner = new ListingCommandRunner([listing, listing, ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start]])]);
    const signals = ProcessTreeTests.signals([own, child]);

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill).endOwnTree(own, start + 30_000);
    const unlisted = await ProcessTreeTests.tree("linux", new ListingCommandRunner([null]), signals.kill).endOwnTree(own, start + 30_000);

    Assert.areEqual(JSON.stringify([true, true, true, false]), JSON.stringify([ended, signals.sent.includes(`${String(own)} SIGTERM`),
      signals.sent.includes(`${String(child)} SIGTERM`), unlisted]));
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("linux", false)
  @TestData("win32", true)
  public async endsNothingUnderAProcessThatIsNotListedWhoseProcessesCannotBeListedOrThatRunsOnWindows(platform: string, listed: boolean): Promise<void> {
    const runner = new ListingCommandRunner([listed ? "" : null]);
    const signals = ProcessTreeTests.signals([]);

    await ProcessTreeTests.tree(platform, runner, signals.kill).endDescendants(2001);

    Assert.areEqual(platform === "win32" ? 0 : 1, runner.calls);
    Assert.areEqual(0, signals.sent.length);
  }

  @TestMethod
  public async killsWhatAnExitedProcessLeftInItsGroupOutsideWindowsWhenItMayHaveStartedSinceThatProcessThoughPsTellsItUpToTwoSecondsEarlyEvenAfterItExited()
    : Promise<void> {
    const [root, early, later, earlier, stranger] = [2001, 2002, 2003, 2004, 2005];
    const second = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const launched = second + 500;
    const groups = [[ProcessTreeTests.ANCESTOR, ProcessTreeTests.ANCESTOR, second - 60_000], [early, root, second - 1000], [later, root, second + 5000], [earlier, root, second - 2000],
      [stranger, ProcessTreeTests.ANCESTOR, second + 5000]];
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("linux", groups)]);
    const signals = ProcessTreeTests.signals([early, later, earlier, stranger]);

    await ProcessTreeTests.tree("linux", runner, signals.kill).endLeftovers(root, launched, second + 1000);

    const [listing] = runner.commands;
    Assert.isDefined(listing);
    Assert.areEqual(JSON.stringify(["-A", "-o", "pid=,pgid=,lstart="]), JSON.stringify(listing.arguments));
    Assert.areEqual(JSON.stringify([`${String(early)} SIGKILL`, `${String(later)} SIGKILL`]), JSON.stringify(signals.sent));
  }

  @TestMethod
  public async waitsOutsideWindowsAtMostTheGraceUntilWhatItKilledInTheGroupOfAnExitedProcessHasEnded(): Promise<void> {
    const [root, left] = [2001, 2002];
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("linux", [[left, root, start + 10_000]])]);
    const timer = new HeldDelayTimer();
    const sent: string[] = [];
    const tree = new ProcessTree("linux", runner, process.env, Resources.processListTimeout, timer, 100, (processId, signal) => {
      sent.push(`${String(processId)} ${String(signal)}`);
    });

    await tree.endLeftovers(root, start, start + 30_000);

    Assert.areEqual(JSON.stringify([`${String(left)} SIGKILL`, `${String(left)} 0`]), JSON.stringify(sent));
    Assert.areEqual(JSON.stringify([100]), JSON.stringify(timer.requested));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async killsNothingOutsideWindowsWhileTheExitedProcessIsListedAgainOrWhenTheGroupsCannotBeListed(listed: boolean): Promise<void> {
    const [root, left] = [2001, 2002];
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const runner = new ListingCommandRunner([listed ? ProcessTreeTests.listing("linux", [[root, root, start + 10_000], [left, root, start + 20_000]]) : null]);
    const signals = ProcessTreeTests.signals([root, left]);

    await ProcessTreeTests.tree("linux", runner, signals.kill).endLeftovers(root, start, start + 30_000);

    Assert.areEqual(1, runner.calls);
    Assert.areEqual(0, signals.sent.length);
  }

  @TestMethod
  public async endsOnWindowsWhatAnExitedProcessLeftUnderItsIdThatStartedSinceItAndNoLaterThanItsExitWithWhatThoseStartedSince(): Promise<void> {
    const launched = Date.now() - 60_000;
    const [root, left, older, reused, grandchild] = [1001, 1002, 1003, 1004, 1005];
    const remaining = [[ProcessTreeTests.ANCESTOR, 1, launched - 60_000], [older, root, launched - 10_000], [reused, root, launched + 30_000]];
    const runner = new ListingCommandRunner([
      ProcessTreeTests.listing("win32", [...remaining, [left, root, launched + 10_000], [grandchild, left, launched + 40_000]]),
      ProcessTreeTests.listing("win32", remaining)]);

    await ProcessTreeTests.tree("win32", runner).endLeftovers(root, launched, launched + 20_000);

    const script = runner.commands[1]?.arguments.at(-1);
    Assert.isDefined(script);
    Assert.areEqual(2, runner.calls);
    Assert.areEqual(`$ids = @(${String(left)}, ${String(grandchild)}); $starts = @(${String(launched + 10_000)}, ${String(launched + 40_000)}); ` +
      `$deadline = [DateTime]::UtcNow.AddMilliseconds(${String(Resources.processExitWait)}); `, script.slice(0, script.indexOf("for (")));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async endsNothingOnWindowsWhenOnlyProcessesStartedAfterTheExitAreListedUnderItsIdOrWhenItCannotList(listed: boolean): Promise<void> {
    const exited = Date.now() - 60_000;
    const runner = new ListingCommandRunner([listed ? ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, exited - 60_000], [1002, 1001, exited + 1]]) : null]);

    await ProcessTreeTests.tree("win32", runner).endLeftovers(1001, exited - 10_000, exited);

    Assert.areEqual(1, runner.calls);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  @TestData("win32")
  public async refusesAndEndsNothingWhenItCannotListTheProcesses(platform: string): Promise<void> {
    const runner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));

    Assert.isFalse(await new ProcessTree(platform, runner, { PATH: "" }, 10_000, new NodeTimer(), 100).endTree(process.pid, Date.now(), process.ppid));
  }

  @Category("ProcessListing")
  @TestMethod
  public async refusesAProcessThatHasEnded(): Promise<void> {
    const tree = ProcessTreeTests.tree(process.platform, new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))));

    Assert.isFalse(await tree.endTree(ProcessTreeTests.GONE, Date.now(), process.pid));
  }

  @Category("ProcessListing")
  @TestMethod
  public runsUnderATimeLimitForTwoListingsAndTheStopGraceWhenItListsTheProcesses(): void {
    const budget = process.env["NOLDOVA_TEST_BUDGET"];

    Assert.isTrue(Number(budget) >= 2 * Resources.processListTimeout + Resources.stopGrace, String(budget));
  }

  @TestMethod
  public runsUnderTheUsualTimeLimitWhenItListsNoProcesses(): void {
    Assert.areEqual("30000", process.env["NOLDOVA_TEST_BUDGET"]);
  }

  @TestMethod
  public async endsATreeOnWindowsThroughItsSessionRatherThanANewPowershellForEachListing(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [task, child] = [ProcessTreeTests.GONE - 2, ProcessTreeTests.GONE - 1];
    const session = new ListingPowershellSession([ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start], [task, ProcessTreeTests.ANCESTOR, start + 10_000],
      [child, task, start + 20_000]]), ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start]])]);
    const runner = new ListingCommandRunner([null]);

    const ended = await new ProcessTree("win32", runner, process.env, 10_000, new NodeTimer(), 100, undefined, session).endTree(task, start + 30_000, ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(0, runner.calls);
    Assert.areEqual(JSON.stringify([[Resources.powershellProcessListScript, 5_000],
      [Resources.formatProcessEndScript([task, child], [start + 10_000, start + 20_000]), 5_000]]), JSON.stringify(session.calls));
  }

  @TestMethod
  public async endsAProcessOnWindowsAgainInTheNextRoundWhenTheListingStillShowsItAfterItsEnd(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [task, child] = [ProcessTreeTests.GONE - 2, ProcessTreeTests.GONE - 1];
    const session = new ListingPowershellSession([
      ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start], [task, ProcessTreeTests.ANCESTOR, start + 10_000], [child, task, start + 20_000]]),
      ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start], [task, ProcessTreeTests.ANCESTOR, start + 10_000]]),
      ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start]])]);

    const ended = await new ProcessTree("win32", new ListingCommandRunner([null]), process.env, 10_000, new NodeTimer(), 100, undefined, session)
      .endTree(task, start + 30_000, ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(JSON.stringify([Resources.powershellProcessListScript, Resources.formatProcessEndScript([task, child], [start + 10_000, start + 20_000]),
      Resources.formatProcessEndScript([task], [start + 10_000])]), JSON.stringify(session.calls.map(t => t[0])));
  }

  @TestMethod
  public async endsAWindowsTreeInItsLastRoundAndReportsItEndedWhenEveryListingStillShowsAProcess(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const task = ProcessTreeTests.GONE - 1;
    const session = new ListingPowershellSession([
      ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start], [task, ProcessTreeTests.ANCESTOR, start + 10_000]])]);

    const ended = await new ProcessTree("win32", new ListingCommandRunner([null]), process.env, 10_000, new NodeTimer(), 100, undefined, session)
      .endTree(task, start + 30_000, ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    Assert.areEqual(JSON.stringify([Resources.powershellProcessListScript, ...Array.from({ length: Resources.processTreeFreezeRounds },
      () => Resources.formatProcessEndScript([task], [start + 10_000]))]), JSON.stringify(session.calls.map(t => t[0])));
  }

  @TestMethod
  public waitsForEachProcessTheEndScriptEndsToExitWithinTheScriptsDeadline(): void {
    const script = Resources.formatProcessEndScript([1001], [5_000]);

    Assert.areEqual(`$ids = @(1001); $starts = @(5000); $deadline = [DateTime]::UtcNow.AddMilliseconds(${String(Resources.processExitWait)}); ` +
      "for ($i = 0; $i -lt $ids.Count; $i++) { try { $p = [System.Diagnostics.Process]::GetProcessById($ids[$i]); $null = $p.Handle; " +
      "if ([Math]::Abs(([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds() - $starts[$i]) -le 1) { $p.Kill(); " +
      "$null = $p.WaitForExit([int][Math]::Max(0, ($deadline - [DateTime]::UtcNow).TotalMilliseconds)) } } catch { } }; ",
      script.slice(0, script.indexOf("}; ") + 3));
  }

  @TestMethod
  @TestData("win32", 1, 1)
  @TestData("linux", 0, 1)
  public async listsThroughItsSessionOnlyOnWindowsThenThroughANewPowershellAndEndsNothingWhenBothFail(platform: string, sessionCalls: number,
    runnerCalls: number): Promise<void> {
    const session = new ListingPowershellSession([null]);
    const runner = new ListingCommandRunner([null]);

    const ended = await new ProcessTree(platform, runner, process.env, 10_000, new NodeTimer(), 100, undefined, session).endTree(process.pid, Date.now(),
      process.ppid);

    Assert.isFalse(ended);
    Assert.areEqual(JSON.stringify([sessionCalls, runnerCalls]), JSON.stringify([session.calls.length, runner.calls]));
  }

  @TestMethod
  public async endsATreeOnWindowsThroughNewPowershellsForTheRestOfTheStopOnceItsSessionFailsTheFirstListing(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [task, child] = [ProcessTreeTests.GONE - 2, ProcessTreeTests.GONE - 1];
    const session = new ListingPowershellSession([null]);
    const runner = new ListingCommandRunner([ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start], [task, ProcessTreeTests.ANCESTOR, start + 10_000],
      [child, task, start + 20_000]]), ProcessTreeTests.listing("win32", [[ProcessTreeTests.ANCESTOR, 1, start]])]);

    const ended = await new ProcessTree("win32", runner, process.env, 10_000, new NodeTimer(), 100, undefined, session).endTree(task, start + 30_000, ProcessTreeTests.ANCESTOR);

    Assert.isTrue(ended);
    const scripts = [Resources.powershellProcessListScript, Resources.formatProcessEndScript([task, child], [start + 10_000, start + 20_000])];
    Assert.areEqual(JSON.stringify([[scripts[0], 5_000]]), JSON.stringify(session.calls));
    Assert.areEqual(JSON.stringify(scripts.map(t => [Resources.powershellExecutable, ...Resources.powershellCommandArguments, t])),
      JSON.stringify(runner.commands.map(t => [t.executable, ...t.arguments])));
    Assert.areEqual(JSON.stringify([5_000, 10_000]), JSON.stringify(runner.timeouts));
  }

  @Category("ProcessListing")
  @TestMethod
  public async endsARunningProcessWhoseSessionFailsEveryScript(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("tree.txt");
    const root = (await ProcessTreeTests.start(path, "stay"))[0] ?? ProcessTreeTests.GONE;
    try {
      const session = new ListingPowershellSession([null]);
      const real = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));

      const ended = await new ProcessTree(process.platform, real, process.env, Resources.processListTimeout, new NodeTimer(), 100, undefined, session)
        .endTree(root, Date.now(), process.pid);
      await Wait.until(() => !ProcessTreeTests.runs(root), "The process still ran.");

      Assert.isTrue(ended);
      Assert.areEqual(process.platform === Resources.windowsPlatform, session.calls.length > 0);
    }
    finally {
      FakeTaskTree.endAll(path);
    }
  }

  @Category("ProcessListing")
  @TestMethod
  public async endsARunningProcessWellInsideTheListingTimeWhenItsSessionNeverAnswers(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("tree.txt");
    const root = (await ProcessTreeTests.start(path, "stay"))[0] ?? ProcessTreeTests.GONE;
    try {
      const silent = new PowershellSession(process.execPath, ["-e", "process.stdin.resume()"], process.env, Resources.powershellSessionIdle);
      const asked: [number, boolean][] = [];
      const session: IPowershellSession = {
        run: (script, timeout) => silent.run(script, timeout).catch((error: unknown) => {
          asked.push([timeout, error instanceof TimeoutException]);
          throw error;
        })
      };
      const runner = new ListingCommandRunner([], new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))));
      const windows = process.platform === Resources.windowsPlatform;

      const ended = await new ProcessTree(process.platform, runner, process.env, Resources.processListTimeout, new NodeTimer(), 100, undefined, session)
        .endTree(root, Date.now(), process.pid);
      await Wait.until(() => !ProcessTreeTests.runs(root), "The process still ran.");

      Assert.isTrue(ended);
      Assert.areEqual(JSON.stringify(windows ? [[Resources.powershellSessionAnswerLimit, true]] : []), JSON.stringify(asked));
      Assert.isTrue(runner.timeouts.length > 0);
      Assert.areEqual(JSON.stringify(runner.timeouts.map((_timeout, index) => windows && index === 0
        ? Resources.processListTimeout - Resources.powershellSessionAnswerLimit : Resources.processListTimeout)), JSON.stringify(runner.timeouts));
    }
    finally {
      FakeTaskTree.endAll(path);
    }
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async endsWhatAStopLeftRunningOutsideTheProcessUnderItsThreadsRootWithItsTreeEvenAfterAListingShowsOnlyAnotherRootsOrphan(
    foreignFirst: boolean): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [server, outer, sandbox, inner, command, sibling, reused, newcomer, foreign] = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3011];
    const [before, after] = ProcessTreeTests.orphanListings(start);
    const runner = new ListingCommandRunner([before!, ...foreignFirst ? [ProcessTreeTests.foreignOrphanListing(start)] : [], after!, after!, ""]);
    const signals = ProcessTreeTests.signals([server, inner, command, sibling, reused, newcomer, 3009, foreign]);
    const stops: number[] = [];

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill, { 3002: "own", 3009: "other" }).endOrphaned(server, () => true, ["own"],
      () => { stops.push(runner.calls); return Promise.resolve(); });

    Assert.areEqual(JSON.stringify([inner, command]), JSON.stringify(ended));
    Assert.areEqual(JSON.stringify([1]), JSON.stringify(stops));
    Assert.areEqual(JSON.stringify([`${String(inner)} SIGSTOP`, `${String(command)} SIGSTOP`, `${String(inner)} SIGTERM`, `${String(command)} SIGTERM`,
      `${String(inner)} SIGCONT`, `${String(command)} SIGCONT`]), JSON.stringify(signals.sent));
    Assert.isFalse([outer, sandbox, sibling, reused, newcomer, 3009, foreign].some(t => signals.sent.some(u => u.startsWith(`${String(t)} `))));
  }

  @TestMethod
  public async keepsListingUnderTwoRootsAfterTheFirstChildIsGoneAndEndsWhatEachLeft(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [before] = ProcessTreeTests.orphanListings(start);
    const kept = [[ProcessTreeTests.ANCESTOR, 1, start], [3001, ProcessTreeTests.ANCESTOR, start + 10_000], [3004, 1, start + 40_000], [3005, 3004, start + 50_000],
      [3006, 3001, start + 15_000], [3007, 3001, start + 16_000]];
    const first = ProcessTreeTests.listing("linux", [...kept, [3009, 3001, start + 17_000], [3010, 3009, start + 18_000], [3011, 3010, start + 19_000]]);
    const both = ProcessTreeTests.listing("linux", [...kept, [3011, 1, start + 19_000]]);
    const runner = new ListingCommandRunner([before!, first, both, both, ""]);
    const signals = ProcessTreeTests.signals([3001, 3004, 3005, 3006, 3007, 3011]);

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill, { 3002: "one", 3009: "two" }).endOrphaned(3001, () => true, ["one", "two"], () => Promise.resolve());

    Assert.areEqual(JSON.stringify([3004, 3005, 3011]), JSON.stringify([...ended].sort()));
    Assert.areEqual(5, runner.calls);
    Assert.isFalse(signals.sent.some(t => t.startsWith("3006 ") || t.startsWith("3007 ")));
  }

  @TestMethod
  public async sparesARootOfAnotherThreadThatEndsInTheWaitAndKeepsWaitingForItsOwn(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [before] = ProcessTreeTests.orphanListings(start);
    const foreignGone = ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [3001, ProcessTreeTests.ANCESTOR, start + 10_000],
      [3002, 3001, start + 20_000], [3003, 3002, start + 30_000], [3004, 3003, start + 40_000], [3005, 3004, start + 50_000], [3006, 3001, start + 15_000], [3011, 1, start + 19_000]]);
    const ownGone = ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [3001, ProcessTreeTests.ANCESTOR, start + 10_000],
      [3004, 1, start + 40_000], [3005, 3004, start + 50_000], [3006, 3001, start + 15_000], [3011, 1, start + 19_000]]);
    const runner = new ListingCommandRunner([before!, foreignGone, ownGone, ownGone, ""]);
    const signals = ProcessTreeTests.signals([3001, 3004, 3005, 3006, 3011]);

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill, { 3002: "own", 3009: "other" }).endOrphaned(3001, () => true, ["own"], () => Promise.resolve());

    Assert.areEqual(JSON.stringify([3004, 3005]), JSON.stringify(ended));
    Assert.areEqual(5, runner.calls);
    Assert.isFalse(signals.sent.some(t => t.startsWith("3011 ")));
  }

  @TestMethod
  public async onlyRunsTheStopWhenAChildsEnvironmentCannotBeRead(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [before] = ProcessTreeTests.orphanListings(start);
    const gone = ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [ProcessTreeTests.GONE, ProcessTreeTests.ANCESTOR, start + 10_000],
      [ProcessTreeTests.GONE - 1, ProcessTreeTests.GONE, start + 20_000]]);
    const runner = new ListingCommandRunner([gone, before!]);
    const signals = ProcessTreeTests.signals([]);
    let stops = 0;

    const tree = new ProcessTree("linux", runner, process.env, Resources.processListTimeout, new NodeTimer(), 100, signals.kill);
    const ended = await tree.endOrphaned(ProcessTreeTests.GONE, () => true, ["own"], () => { stops++; return Promise.resolve(); });

    Assert.areEqual(0, ended.length);
    Assert.areEqual(JSON.stringify([1, 1]), JSON.stringify([stops, runner.calls]));
    Assert.areEqual(0, signals.sent.length);
  }

  @TestMethod
  public async keepsWaitingForItsRootWhenAListingFailsAfterTheStop(): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [before, after] = ProcessTreeTests.orphanListings(start);
    const runner = new ListingCommandRunner([before!, null, after!, after!, ""]);
    const signals = ProcessTreeTests.signals([3001, 3004, 3005, 3006, 3007, 3008, 3009, 3011]);

    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill, { 3002: "own", 3009: "other" }).endOrphaned(3001, () => true, ["own"], () => Promise.resolve());

    Assert.areEqual(JSON.stringify([3004, 3005]), JSON.stringify(ended));
  }

  @TestMethod
  @TestData(0, 1)
  @TestData(1, 1)
  @TestData(2, 2)
  @TestData(3, 3)
  @TestData(4, 3)
  @TestData(5, 2)
  @TestData(6, 1)
  @TestData(7, 1)
  @TestData(8, 1)
  public async onlyRunsTheStopWhenTheFirstListingFailsOrMissesTheProcessWhenItIsGoneOrCannotBeListedAfterTheStopOrWhenNothingIsLeftUnderTheEndedRootsOrItsPidIsRecycledOrNoChildNamesTheThread(
    scenario: number, calls: number): Promise<void> {
    const start = Math.floor(Date.now() / 1000) * 1000 - 60_000;
    const [before] = ProcessTreeTests.orphanListings(start);
    const rootsGone = ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [3001, ProcessTreeTests.ANCESTOR, start + 10_000], [3006, 3001, start + 15_000],
      [3009, 3001, start + 17_000], [3010, 3009, start + 18_000], [3011, 3010, start + 19_000]]);
    const runner = new ListingCommandRunner([[null], [""], [before!, ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start]])],
      [before!, before!, before!], [before!, null], [before!, rootsGone], [before!], [before!], [before!]][scenario]!);
    const signals = ProcessTreeTests.signals([3001, 3002, 3003, 3004, 3005, 3006, 3007]);
    let stops = 0;

    const threads = scenario === 7 ? { 3002: "other" } : scenario === 8 ? {} : { 3002: "own" };
    const ended = await ProcessTreeTests.tree("linux", runner, signals.kill, threads).endOrphaned(3001, () => scenario !== 6, ["own"], () => { stops++; return Promise.resolve(); });

    Assert.areEqual(0, ended.length);
    Assert.areEqual(1, stops);
    Assert.areEqual(calls, runner.calls);
    Assert.areEqual(0, signals.sent.length);
  }

  private static tree(platform: string, runner: CommandRunner, kill?: (processId: number, signal: NodeJS.Signals | 0) => void,
    threads: Readonly<Record<number, string>> = {}): ProcessTree {
    return new ProcessTree(platform, runner, process.env, Resources.processListTimeout, new NodeTimer(), 100, kill, null, path => {
      const thread = threads[Number(path.split("/")[2])];
      return `PATH=/usr/bin\0${Object.isUndefined(thread) ? "" : `CODEX_THREAD_ID=${thread}\0`}HOME=/home/person`;
    });
  }

  private static signals(running: readonly number[]): { kill: (processId: number, signal: NodeJS.Signals | 0) => void; sent: string[] } {
    const alive = new Set(running);
    const sent: string[] = [];
    return {
      sent,
      kill: (processId, signal) => {
        if (!alive.has(processId))
          throw new Error("kill ESRCH");
        if (signal === 0)
          return;
        sent.push(`${String(processId)} ${signal}`);
        if (signal === "SIGKILL")
          alive.delete(processId);
      }
    };
  }

  private static async start(path: string, ...modes: FakeTaskTreeMode[]): Promise<number[]> {
    for (const mode of modes)
      FakeTaskTree.start(path, 1, mode);
    await Wait.until(() => FakeTaskTree.read(path).length === modes.length, "The task tree did not get every mode's process.");
    return FakeTaskTree.read(path);
  }

  private static async startsOf(runner: CommandRunner): Promise<Map<number, number>> {
    const result = await runner.run(new ProcessCommand(Resources.powershellExecutable, Resources.powershellProcessListArguments), process.env,
      Resources.processListTimeout).catch(() => null);
    return new Map([...(result?.stdout ?? "").matchAll(Resources.processParentPattern)].map(t => [Number(t[1]), Number(t[3])]));
  }

  private static orphanListings(start: number): string[] {
    const before = [[ProcessTreeTests.ANCESTOR, 1, start], [3001, ProcessTreeTests.ANCESTOR, start + 10_000], [3002, 3001, start + 20_000], [3003, 3002, start + 30_000],
      [3004, 3003, start + 40_000], [3005, 3004, start + 50_000], [3006, 3001, start + 15_000], [3007, 3001, start + 16_000], [3009, 3001, start + 17_000],
      [3010, 3009, start + 18_000], [3011, 3010, start + 19_000]];
    const after = [[ProcessTreeTests.ANCESTOR, 1, start], [3001, ProcessTreeTests.ANCESTOR, start + 10_000], [3004, 1, start + 40_000], [3005, 3004, start + 50_000],
      [3006, 3001, start + 15_000], [3007, 1, start + 55_000], [3008, 1, start + 56_000], [3009, 3001, start + 17_000], [3011, 1, start + 19_000]];
    return [ProcessTreeTests.listing("linux", before), ProcessTreeTests.listing("linux", after), ProcessTreeTests.listing("linux", after)];
  }

  private static foreignOrphanListing(start: number): string {
    return ProcessTreeTests.listing("linux", [[ProcessTreeTests.ANCESTOR, 1, start], [3001, ProcessTreeTests.ANCESTOR, start + 10_000], [3002, 3001, start + 20_000],
      [3003, 3002, start + 30_000], [3004, 3003, start + 40_000], [3005, 3004, start + 50_000], [3006, 3001, start + 15_000], [3007, 3001, start + 16_000],
      [3009, 3001, start + 17_000], [3011, 1, start + 19_000]]);
  }

  private static listing(platform: string, entries: readonly (readonly number[])[]): string {
    return entries.map(t => `${String(t[0])} ${String(t[1])} ${platform === "win32" ? String(t[2]) : ProcessTreeTests.lstart(t[2]!)}\n`).join("");
  }

  private static lstart(time: number): string {
    const date = new Date(time);
    const clock = [date.getHours(), date.getMinutes(), date.getSeconds()].map(t => String(t).padStart(2, "0")).join(":");
    return `${ProcessTreeTests.DAYS[date.getDay()]} ${ProcessTreeTests.MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, " ")} ${clock} ${date.getFullYear()}`;
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
