/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { Condition } from "../fixtures/condition.fixture.js";
import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class TerminalRelaunchTests {
  @TestMethod
  @TestData("darwin")
  @TestData("linux")
  public async startsItselfApartFromTheTerminalItWasStartedInAndExitsBeforeItsWindowOrRuntime(platform: string): Promise<void> {
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess(platform, ["/electron/electron", "--lang=en-US", "notes"], { HOME: "/home/person" });
    process.isTerminal = true;
    const launcher = new FakeRuntimeLauncher();

    DesktopStartFixture.start(electron, process, launcher);
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));
    await electron.app.becomeReadyAsync();
    await setImmediate();

    Assert.areEqual(JSON.stringify(["releaseSingleInstanceLock", "exit 0"]), JSON.stringify(TerminalRelaunchTests.callsAfterTheSandbox(electron)));
    Assert.areEqual(
      JSON.stringify([{ command: ["/electron/electron", "--lang=en-US", "notes"], environment: { HOME: "/home/person" }, workingDirectory: process.workingDirectory }]),
      JSON.stringify(process.relaunched));
    Assert.areEqual(0, electron.windows.length);
    Assert.areEqual(0, electron.app.count("window-all-closed"));
    Assert.areEqual(0, launcher.calls.length);
  }

  @TestMethod
  @TestData("/home/person/work")
  @TestData(null)
  public async startsItsAppImageAgainFromTheImageInTheFolderItWasStartedIn(startFolder: string | null): Promise<void> {
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("linux", ["/electron/electron", "--no-sandbox", "./notes"], {
      APPIMAGE: "/home/person/Applications/TeamRun.AppImage",
      APPDIR: "/electron",
      ...Object.isNull(startFolder) ? {} : { OWD: startFolder }
    });
    process.isTerminal = true;

    DesktopStartFixture.start(electron, process);
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

    Assert.areEqual(
      JSON.stringify([{ command: ["/home/person/Applications/TeamRun.AppImage", "--no-sandbox", "./notes"], environment: {}, workingDirectory: startFolder ?? process.workingDirectory }]),
      JSON.stringify(process.relaunched));
  }

  @TestMethod
  @TestData("linux", false, true, "--lang=en-US", "")
  @TestData("linux", true, false, "--lang=en-US", "")
  @TestData("win32", true, true, "--lang=en-US", "")
  @TestData("darwin", true, true, "--enable-logging", "")
  @TestData("darwin", true, true, "--enable-logging=stderr", "")
  @TestData("darwin", true, true, "--remote-debugging-port=9222", "")
  @TestData("darwin", true, true, "--remote-debugging-pipe", "")
  @TestData("darwin", true, true, "--lang=en-US", "1")
  public async staysWhereItStartedUnlessItIsAPackagedBuildOnLinuxOrMacOSInATerminalThatNothingWritesTo(platform: string, isPackaged: boolean, isTerminal: boolean, argument: string, logging: string): Promise<void> {
    const electron = new FakeElectron(true, isPackaged);
    const process = new FakeDesktopProcess(platform, ["/electron/electron", argument], { ELECTRON_ENABLE_LOGGING: logging });
    process.isTerminal = isTerminal;

    DesktopStartFixture.start(electron, process);
    await setImmediate();

    Assert.areEqual(0, process.relaunched.length);
    Assert.areEqual(JSON.stringify([]), JSON.stringify(TerminalRelaunchTests.callsAfterTheSandbox(electron)));
    Assert.areEqual(1, electron.app.count("window-all-closed"));
  }

  @TestMethod
  public async handsOverToTheRunningDesktopFromATerminalWithoutStartingItselfAgain(): Promise<void> {
    const electron = new FakeElectron(false, true);
    const process = new FakeDesktopProcess("linux", ["/electron/electron"]);
    process.isTerminal = true;

    DesktopStartFixture.start(electron, process);
    await setImmediate();

    Assert.areEqual(0, process.relaunched.length);
    Assert.areEqual("requestSingleInstanceLock,quit", electron.app.calls.slice(-2).join(","));
  }

  @TestMethod
  @TestData(true, "releaseSingleInstanceLock,requestSingleInstanceLock", 1)
  @TestData(false, "releaseSingleInstanceLock,requestSingleInstanceLock,quit", 0)
  public async runsInTheTerminalWhenItCannotStartItselfApartFromIt(regainsLock: boolean, calls: string, listeners: number): Promise<void> {
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("darwin", ["/electron/electron"]);
    process.isTerminal = true;
    process.relaunchFailure = new Error("spawn EACCES");

    DesktopStartFixture.start(electron, process);
    electron.app.hasLock = regainsLock;
    await Condition.waitAsync(() => process.errors.includes("could not start itself"));
    await setImmediate();

    Assert.isTrue(process.errors.includes("TeamRun could not start itself apart from the terminal, so it runs in the terminal and quits when the terminal closes: Error: spawn EACCES"));
    Assert.areEqual(calls, TerminalRelaunchTests.callsAfterTheSandbox(electron).join(","));
    Assert.areEqual(listeners, electron.app.count("window-all-closed"));
  }

  private static callsAfterTheSandbox(electron: FakeElectron): string[] {
    return electron.app.calls.slice(electron.app.calls.indexOf("enableSandbox") + 1);
  }
}
