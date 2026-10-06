/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, mkdir, mkdtemp, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { PathCommand, PathCommandException, PathCommandOutcome } from "@noldova/teamrun-shell-desktop";

@TestClass
export class PathCommandTests {
  @TestMethod
  public linksTheBundleCommandInTheFolderItMakesAndKeepsALinkThatIsAlreadyRight(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "usr", "local", "bin", "teamrun");
      const ran: (readonly string[])[] = [];
      const command = new PathCommand(target, link, (program, args) => {
        ran.push([program, ...args]);
        return Promise.resolve();
      });

      const outcomes = [await command.installAsync(), await command.installAsync()];

      Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.AlreadyInstalled].join(), outcomes.join());
      Assert.areEqual(target, await readlink(link));
      Assert.areEqual(link, command.linkPath);
      Assert.areEqual(0, ran.length);
    });
  }

  @TestMethod
  public replacesALinkToElsewhereAndLeavesAFileThatIsNotALink(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const stale = path.join(folder, "stale");
      const file = path.join(folder, "file");
      await symlink(path.join(folder, "old", "teamrun"), stale);
      await writeFile(file, "someone else's teamrun\n");

      const outcomes = [await new PathCommand(target, stale, () => Promise.resolve()).installAsync(), await new PathCommand(target, file, () => Promise.resolve()).installAsync()];

      Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.Occupied].join(), outcomes.join());
      Assert.areEqual(target, await readlink(stale));
    });
  }

  @TestMethod
  public reportsABuildWithoutACommandWithoutTouchingTheLink(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async folder => {
      const link = path.join(folder, "teamrun");

      const outcome = await new PathCommand(path.join(folder, "missing"), link, () => Promise.resolve()).installAsync();

      Assert.areEqual(PathCommandOutcome.Missing, outcome);
      Assert.isFalse(await PathCommandTests.existsAsync(link));
    });
  }

  @TestMethod
  public asksForAnAdministratorWhenTheFolderCannotBeWrittenAndReportsACancelledPrompt(): Promise<void> {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return Promise.resolve();
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const locked = path.join(folder, "locked");
      await mkdir(locked);
      await chmod(locked, 0o555);
      const link = path.join(locked, "bin", "teamrun");
      const ran: (readonly string[])[] = [];
      const answers = [(): Promise<void> => Promise.resolve(), (): Promise<void> => Promise.reject(new Error("Command failed: /usr/bin/osascript\n0:200: execution error: User canceled. (-128)"))];

      try {
        const outcomes = [];
        for (const answer of answers)
          outcomes.push(await new PathCommand(target, link, (program, args) => {
            ran.push([program, ...args]);
            return answer();
          }).installAsync());

        Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.Cancelled].join(), outcomes.join());
        Assert.areEqual("/usr/bin/osascript", ran[0]?.[0]);
        Assert.areEqual([target, path.join(locked, "bin"), link].join(), ran[0]?.slice(-4, -1).join());
        Assert.areEqual(`TeamRun wants to link ${link} to its teamrun command, so that terminals can run it.`, ran[0]?.at(-1));
        Assert.isTrue(ran[0]?.some(t => t.includes("with administrator privileges")) === true);
      }
      finally {
        await chmod(locked, 0o755);
      }
    });
  }

  @TestMethod
  public failsWithTheReasonWhenTheLinkCannotBeMadeOrTheAdministratorPromptFails(): Promise<void> {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return Promise.resolve();
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const file = path.join(folder, "file");
      await writeFile(file, "not a folder\n");
      const locked = path.join(folder, "locked");
      await mkdir(locked);
      await chmod(locked, 0o555);
      const messages: string[] = [];

      try {
        for (const command of [
          new PathCommand(target, path.join(file, "teamrun"), () => Promise.resolve()),
          new PathCommand(target, path.join(locked, "teamrun"), () => Promise.reject(new Error("Command failed: /usr/bin/osascript\nThe administrator user name or password was incorrect.")))
        ]) {
          const error = await command.installAsync().then(() => null, (t: unknown) => t);
          Assert.isTrue(error instanceof PathCommandException);
          messages.push(String((error as PathCommandException).message));
        }
      }
      finally {
        await chmod(locked, 0o755);
      }

      Assert.isTrue(messages[0]?.startsWith(`The teamrun command could not be linked at ${path.join(file, "teamrun")}: Error: ENOTDIR`) === true, messages[0]);
      Assert.areEqual(`The teamrun command could not be linked at ${path.join(locked, "teamrun")}: Error: Command failed: /usr/bin/osascript\nThe administrator user name or password was incorrect.`, messages[1]);
    });
  }

  @TestMethod
  public linksTheCommandInsideTheBundleTheDesktopRunsFromInUsrLocalBin(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async folder => {
      const command = PathCommand.forBundle(path.join(folder, "Unpackaged.app", "Contents", "MacOS", "TeamRun"), () => Promise.resolve());

      const outcome = await command.installAsync();

      Assert.areEqual(PathCommandOutcome.Missing, outcome);
      Assert.areEqual(path.join("/usr/local/bin", "teamrun"), command.linkPath);
    });
  }

  private static async existsAsync(file: string): Promise<boolean> {
    try {
      await readlink(file);
      return true;
    }
    catch {
      return false;
    }
  }

  private static async runInFolderAsync(action: (folder: string, target: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-path-command-"));
    try {
      const target = path.join(folder, "TeamRun.app", "Contents", "Resources", "bin", "teamrun");
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "#!/bin/sh\n");
      await action(folder, target);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
