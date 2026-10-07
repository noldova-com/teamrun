/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { InstallerStart, UpdateHandoffException } from "@noldova/teamrun-shell-desktop";
import { type IProcessStarter, LaunchException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class InstallerStartTests {
  private static readonly INSTALLER: string = "C:\\Users\\Person\\AppData\\Local\\teamrun-updater\\pending\\TeamRun-win-x64.exe";
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = { USERPROFILE: "C:\\Users\\Person" };
  private static readonly ERROR_FILE: string = "C:\\Users\\Person\\TeamRun\\logs\\installer.log";

  @TestMethod
  public async checksTheSignatureAgainAndThenStartsTheInstallerQuietlyAsAnUpdate(): Promise<void> {
    const steps: string[] = [];
    const calls: [string, readonly string[], NodeJS.ProcessEnv, string][] = [];
    const start = new InstallerStart(InstallerStartTests.createStarter(steps, calls, 5120), installer => {
      steps.push(`verify ${installer}`);
      return Promise.resolve(null);
    }, InstallerStartTests.ENVIRONMENT, InstallerStartTests.ERROR_FILE);

    const processId = await start.startAsync(InstallerStartTests.INSTALLER);

    Assert.areEqual(5120, processId);
    Assert.areEqual(JSON.stringify([`verify ${InstallerStartTests.INSTALLER}`, "start"]), JSON.stringify(steps));
    Assert.areEqual(JSON.stringify([[InstallerStartTests.INSTALLER, ["--updated", "/S", "--force-run"], InstallerStartTests.ENVIRONMENT, InstallerStartTests.ERROR_FILE]]),
      JSON.stringify(calls));
  }

  @TestMethod
  public async refusesToStartAnInstallerThePublisherDidNotSign(): Promise<void> {
    const steps: string[] = [];
    const start = new InstallerStart(InstallerStartTests.createStarter(steps, [], 5120), () => Promise.resolve("The file is not signed by Noldova."),
      InstallerStartTests.ENVIRONMENT, InstallerStartTests.ERROR_FILE);

    const failure = await Assert.throwsAsync(() => start.startAsync(InstallerStartTests.INSTALLER), UpdateHandoffException);

    Assert.areEqual(`The update's installer ${InstallerStartTests.INSTALLER} is not signed by the publisher, so it was not started: The file is not signed by Noldova.`,
      failure.message);
    Assert.areEqual(0, steps.length);
  }

  @TestMethod
  public async reportsAnInstallerThatCannotBeStarted(): Promise<void> {
    const cause = new LaunchException("The program could not be started.");
    const starter: IProcessStarter = { startAsync: () => Promise.reject(cause) };
    const start = new InstallerStart(starter, () => Promise.resolve(null), InstallerStartTests.ENVIRONMENT, InstallerStartTests.ERROR_FILE);

    const failure = await Assert.throwsAsync(() => start.startAsync(InstallerStartTests.INSTALLER), UpdateHandoffException);

    Assert.areEqual(`The update's installer ${InstallerStartTests.INSTALLER} could not be started: ${String(cause)}`, failure.message);
    Assert.areEqual(cause, failure.cause);
  }

  private static createStarter(steps: string[], calls: [string, readonly string[], NodeJS.ProcessEnv, string][], processId: number): IProcessStarter {
    return {
      startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
        steps.push("start");
        calls.push([executable, launchArguments, environment, errorFile]);
        return Promise.resolve(processId);
      }
    };
  }
}
