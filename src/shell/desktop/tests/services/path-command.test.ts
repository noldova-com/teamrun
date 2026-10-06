/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { PathCommand, PathCommandException, PathCommandOutcome } from "@noldova/teamrun-shell-desktop";

import { RefusedPathCommand } from "../fixtures/refused-path-command.fixture.js";

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
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "bin", "teamrun");
      const ran: (readonly string[])[] = [];
      const answers = [
        ["EACCES", (): Promise<void> => Promise.resolve()],
        ["EPERM", (): Promise<void> => Promise.reject(new Error("Command failed: /usr/bin/osascript\n0:200: execution error: User canceled. (-128)"))]
      ] as const;

      const outcomes = [];
      for (const [code, answer] of answers)
        outcomes.push(await new RefusedPathCommand(target, link, (program, args) => {
          ran.push([program, ...args]);
          return answer();
        }, code).installAsync());

      Assert.areEqual([PathCommandOutcome.Installed, PathCommandOutcome.Cancelled].join(), outcomes.join());
      Assert.areEqual("/usr/bin/osascript", ran[0]?.[0]);
      Assert.areEqual([target, path.join(folder, "bin"), link].join(), ran[0]?.slice(-4, -1).join());
      Assert.areEqual(`TeamRun wants to link ${link} to its teamrun command, so that terminals can run it.`, ran[0]?.at(-1));
      Assert.isTrue(ran[0]?.some(t => t.includes("with administrator privileges")) === true);
    });
  }

  @TestMethod
  public failsWithTheReasonWhenTheLinkCannotBeMadeOrTheAdministratorPromptFails(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const link = path.join(folder, "bin", "teamrun");
      const messages: string[] = [];

      for (const command of [
        new RefusedPathCommand(target, link, () => Promise.resolve(), "ENOTDIR"),
        new RefusedPathCommand(target, link, () => Promise.reject(new Error("Command failed: /usr/bin/osascript\nThe administrator user name or password was incorrect.")), "EACCES")
      ]) {
        const error = await command.installAsync().then(() => null, (t: unknown) => t);
        Assert.isTrue(error instanceof PathCommandException);
        messages.push(String((error as PathCommandException).message));
      }

      Assert.areEqual([
        `The teamrun command could not be linked at ${link}: Error: ENOTDIR: the link could not be made`,
        `The teamrun command could not be linked at ${link}: Error: Command failed: /usr/bin/osascript\nThe administrator user name or password was incorrect.`
      ].join("|"), messages.join("|"));
    });
  }

  @TestMethod
  public findsNoLinkWhereItsFolderCannotBeReadAndFailsWithTheReasonTheLinkCannotBeMade(): Promise<void> {
    return PathCommandTests.runInFolderAsync(async (folder, target) => {
      const file = path.join(folder, "file");
      await writeFile(file, "not a folder\n");
      const link = path.join(file, "bin", "teamrun");

      const error = await new PathCommand(target, link, () => Promise.reject(new Error("No administrator is asked."))).installAsync().then(() => null, (t: unknown) => t);

      Assert.isTrue(error instanceof PathCommandException);
      Assert.isTrue(String((error as PathCommandException).message).startsWith(`The teamrun command could not be linked at ${link}: Error: `));
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
