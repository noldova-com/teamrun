/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallHeldException, InstallRename, Resources } from "@noldova/teamrun.providers";

import { RecordedDelayTimer } from "../../fixtures/recorded-delay-timer.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class InstallRenameTests {
  @TestMethod
  public async movesTheFolderOnATryAfterWindowsRefusesTheRenameWhileSomethingStillHoldsAFileInIt(): Promise<void> {
    for (const code of ["EPERM", "EACCES", "EBUSY"]) {
      using directory = new TemporaryDirectory();
      const from = InstallRenameTests.folder(directory);
      const to = directory.resolve("1.19.4");
      const timer = new RecordedDelayTimer();
      const refused = InstallRenameTests.refusing(code, 3);

      await new InstallRename("win32", refused.rename, timer).moveAsync(from, to);

      Assert.areEqual(4, refused.tries, code);
      Assert.areEqual("50,100,200", timer.delays.join(","), code);
      Assert.isFalse(existsSync(from), code);
      Assert.areEqual("new", readFileSync(join(to, "opencode.exe"), "utf8"), code);
    }
  }

  @TestMethod
  public async failsAsHeldWithTheRenamesErrorAsItsCauseOnceItsWaitsWouldPassTheLimit(): Promise<void> {
    using directory = new TemporaryDirectory();
    const from = InstallRenameTests.folder(directory);
    const timer = new RecordedDelayTimer();
    const refused = InstallRenameTests.refusing("EBUSY", Number.POSITIVE_INFINITY);

    const failure = await Assert.throwsAsync(() => new InstallRename("win32", refused.rename, timer).moveAsync(from, directory.resolve("1.19.4")), InstallHeldException);

    Assert.areEqual(refused.last, failure.cause);
    Assert.areEqual("EBUSY: refused", failure.message);
    Assert.areEqual("EBUSY", failure.code);
    Assert.areEqual("EBUSY", InstallRename.codeOf(failure));
    Assert.areEqual("50,100,200,400,800,1000,1000,1000,1000,1000,1000,1000,1000", timer.delays.join(","));
    Assert.areEqual(timer.delays.length + 1, refused.tries);
    Assert.isTrue(timer.now() <= Resources.renameRetryLimit && timer.now() + Resources.renameRetryLongestDelay > Resources.renameRetryLimit, String(timer.now()));
    Assert.isTrue(existsSync(from));
  }

  @TestMethod
  public async failsAtOnceOnAnErrorItDoesNotRetry(): Promise<void> {
    for (const error of [Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" }), Object.assign(new Error("EXDEV: cross-device link"), { code: "EXDEV" }),
      new Error("no code")]) {
      const timer = new RecordedDelayTimer();
      let tries = 0;

      const failure = await Assert.throwsAsync(() => new InstallRename("win32", () => {
        tries++;
        throw error;
      }, timer).moveAsync("from", "to"), Error);

      Assert.areEqual(error, failure);
      Assert.areEqual(1, tries, error.message);
      Assert.areEqual(0, timer.delays.length, error.message);
    }
  }

  @TestMethod
  public async failsAtOnceOnAThrownValueThatIsNoError(): Promise<void> {
    const timer = new RecordedDelayTimer();
    const thrown: unknown = { code: "EPERM" };
    let tries = 0;

    const failure = await new InstallRename("win32", () => {
      tries++;
      throw thrown;
    }, timer).moveAsync("from", "to").then(() => null, (error: unknown) => error);

    Assert.areEqual(thrown, failure);
    Assert.areEqual(1, tries);
    Assert.areEqual(0, timer.delays.length);
  }

  @TestMethod
  public async failsAtOnceWhenARetriedRenameIsRefusedWithAnErrorItDoesNotRetry(): Promise<void> {
    const timer = new RecordedDelayTimer();
    const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
    const missing = Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
    let tries = 0;

    const failure = await Assert.throwsAsync(() => new InstallRename("win32", () => {
      tries++;
      throw tries === 1 ? busy : missing;
    }, timer).moveAsync("from", "to"), Error);

    Assert.areEqual(missing, failure);
    Assert.areEqual(2, tries);
    Assert.areEqual("50", timer.delays.join(","));
  }

  @TestMethod
  public async failsAtOnceOutsideWindowsOnTheCodesItRetriesOnWindows(): Promise<void> {
    for (const platform of ["linux", "darwin"])
      for (const code of ["EPERM", "EACCES", "EBUSY"]) {
        const timer = new RecordedDelayTimer();
        const refused = InstallRenameTests.refusing(code, 1);

        const failure = await Assert.throwsAsync(() => new InstallRename(platform, refused.rename, timer).moveAsync("from", "to"), Error);

        Assert.areEqual(refused.last, failure);
        Assert.areEqual(1, refused.tries, `${platform} ${code}`);
        Assert.areEqual(0, timer.delays.length, `${platform} ${code}`);
      }
  }

  @TestMethod
  public async waitsOnTheClockByDefault(): Promise<void> {
    using directory = new TemporaryDirectory();
    const from = InstallRenameTests.folder(directory);
    const to = directory.resolve("1.19.4");
    const refused = InstallRenameTests.refusing("EPERM", 1);
    const started = performance.now();

    await new InstallRename("win32", refused.rename).moveAsync(from, to);

    Assert.isTrue(performance.now() - started >= Resources.renameRetryFirstDelay - 5, String(performance.now() - started));
    Assert.areEqual(2, refused.tries);
    Assert.isTrue(existsSync(to));
  }

  private static folder(directory: TemporaryDirectory): string {
    const folder = directory.resolve(".teamrun-staging-1", "opencode");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "opencode.exe"), "new");
    return folder;
  }

  private static refusing(code: string, refusals: number): { readonly rename: (from: string, to: string) => void; readonly tries: number; readonly last: Error | null } {
    const refused: { tries: number; last: Error | null; readonly rename: (from: string, to: string) => void } = {
      tries: 0,
      last: null,
      rename: (from: string, to: string): void => {
        refused.tries++;
        if (refused.tries > refusals) {
          renameSync(from, to);
          return;
        }
        refused.last = Object.assign(new Error(`${code}: refused`), { code });
        throw refused.last;
      },
    };
    return refused;
  }
}
