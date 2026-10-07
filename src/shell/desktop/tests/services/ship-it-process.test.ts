/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import { Assert, TestClass, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";
import { ShipItProcess, UpdateHandoffException } from "@noldova/teamrun-shell-desktop";
import { SystemCommand, SystemCommandException } from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class ShipItProcessTests {
  private static readonly BUNDLE: string = "com.noldova.teamrun";
  private static readonly LIST: string = [
    "PID\tStatus\tLabel",
    "811\t0\tcom.example.other.ShipIt",
    "-\t0\tcom.noldova.teamrun.ShipItHelper",
    "4512\t0\tcom.noldova.teamrun.ShipIt",
    "-\t78\tcom.apple.example",
    ""
  ].join("\n");

  @TestMethod
  public async findsTheProcessOfItsApplicationsShipItJob(): Promise<void> {
    const calls: [string, readonly string[]][] = [];
    const shipIt = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));

    const processId = await shipIt.findAsync();

    Assert.areEqual(4512, processId);
    Assert.areEqual(JSON.stringify([["/bin/launchctl", ["list"]]]), JSON.stringify(calls));
  }

  @TestMethod
  public async findsNoProcessWhenTheJobIsNotRunningOrNotListed(): Promise<void> {
    const stopped = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand([], "PID\tStatus\tLabel\n-\t0\tcom.noldova.teamrun.ShipIt\n"));
    const missing = new ShipItProcess("com.noldova.teamrun.development", ShipItProcessTests.createCommand([], ShipItProcessTests.LIST));

    Assert.isNull(await stopped.findAsync());
    Assert.isNull(await missing.findAsync());
  }

  @TestMethod
  public async removesItsJobOnlyWhenItIsListed(): Promise<void> {
    const calls: [string, readonly string[]][] = [];
    const listed = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));
    const unlisted = new ShipItProcess("com.noldova.teamrun.development", ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));

    await listed.removeAsync();
    await unlisted.removeAsync();

    Assert.areEqual(JSON.stringify([["/bin/launchctl", ["list"]], ["/bin/launchctl", ["remove", "com.noldova.teamrun.ShipIt"]], ["/bin/launchctl", ["list"]]]),
      JSON.stringify(calls));
  }

  @TestMethod
  public async removesOnlyAStoppedJobAtStart(): Promise<void> {
    const calls: [string, readonly string[]][] = [];
    const running = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));
    const stopped = new ShipItProcess(ShipItProcessTests.BUNDLE,
      ShipItProcessTests.createCommand(calls, "PID\tStatus\tLabel\n-\t0\tcom.noldova.teamrun.ShipIt\n"));
    const unlisted = new ShipItProcess("com.noldova.teamrun.development", ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));

    await running.removeStoppedAsync();
    await stopped.removeStoppedAsync();
    await unlisted.removeStoppedAsync();

    Assert.areEqual(JSON.stringify([
      ["/bin/launchctl", ["list"]], ["/bin/launchctl", ["list"]], ["/bin/launchctl", ["remove", "com.noldova.teamrun.ShipIt"]], ["/bin/launchctl", ["list"]]
    ]), JSON.stringify(calls));
  }

  @TestMethod
  public async reportsJobsThatCannotBeListedOrAJobThatCannotBeRemoved(): Promise<void> {
    const cause = new SystemCommandException("/bin/launchctl failed: Bad request.");
    const unlisted = new ShipItProcess(ShipItProcessTests.BUNDLE, { runAsync: () => Promise.reject(cause) });
    const unremovable = new ShipItProcess(ShipItProcessTests.BUNDLE, {
      runAsync: (_file: string, commandArguments: readonly string[]) => commandArguments[0] === "list" ? Promise.resolve(ShipItProcessTests.LIST) : Promise.reject(cause)
    });

    const unread = await Assert.throwsAsync(() => unlisted.findAsync(), UpdateHandoffException);
    const unremoved = await Assert.throwsAsync(() => unremovable.removeAsync(), UpdateHandoffException);

    Assert.areEqual(`The installer process of the staged update could not be looked up: ${String(cause)}`, unread.message);
    Assert.areEqual(cause, unread.cause);
    Assert.isTrue(unremoved.message.startsWith("The staged update could not be withdrawn, so it may install when "), unremoved.message);
    Assert.isTrue(unremoved.message.endsWith(` quits: ${String(cause)}`), unremoved.message);
    Assert.areEqual(cause, unremoved.cause);
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async findsAndRemovesARealLaunchdJob(): Promise<void> {
    const bundle = `com.noldova.teamrun.test-${randomUUID()}`;
    const command = new SystemCommand();
    const shipIt = new ShipItProcess(bundle, command);
    await command.runAsync("/bin/launchctl", ["submit", "-l", `${bundle}.ShipIt`, "--", "/bin/sleep", "60"]);
    try {
      let processId: number | null = null;
      Assert.isTrue(await Wait.untilAsync(async () => !Object.isNull(processId = await shipIt.findAsync()), 10_000, 100));
      Assert.isTrue(Number.isSafeInteger(processId));

      await shipIt.removeAsync();

      Assert.isTrue(await Wait.untilAsync(async () => !(await command.runAsync("/bin/launchctl", ["list"])).includes(`${bundle}.ShipIt`), 10_000, 100));
      Assert.isNull(await shipIt.findAsync());
    }
    finally {
      await command.runAsync("/bin/launchctl", ["remove", `${bundle}.ShipIt`]).catch(() => undefined);
    }
  }

  private static createCommand(calls: [string, readonly string[]][], output: string): Pick<SystemCommand, "runAsync"> {
    return {
      runAsync(file: string, commandArguments: readonly string[]): Promise<string> {
        calls.push([file, commandArguments]);
        return Promise.resolve(output);
      }
    };
  }
}
