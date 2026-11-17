/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import fs, { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join, relative, resolve } from "node:path";

import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChatFolders, Resources } from "@noldova/teamrun.core";
import { ErrorCode } from "@noldova/teamrun.protocol";

import { GitRepository } from "../../fixtures/git-repository.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ChatFoldersTests {
  @TestMethod
  public makesEachChatsFolderInTheDataFolderWithAGitRootOfItsOwnAndKeepsWhatItHolds(): void {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);

    Assert.isFalse(folders.exists("c1"));
    Assert.areEqual(0, folders.list().length);
    const path = folders.prepare("c1");
    writeFileSync(join(path, "notes.md"), "kept");
    writeFileSync(join(path, ".git", "HEAD"), "ref: refs/heads/other\n");
    folders.prepare("c1");

    Assert.areEqual(join(directory.path, "chats", "c1"), path);
    Assert.areEqual(path, folders.pathOf("c1"));
    Assert.isTrue(folders.exists("c1"));
    Assert.areEqual("c1", folders.list().join(","));
    Assert.areEqual("kept", readFileSync(join(path, "notes.md"), "utf8"));
    Assert.areEqual("ref: refs/heads/other\n", readFileSync(join(path, ".git", "HEAD"), "utf8"));
    Assert.areEqual(Resources.chatGitConfig, readFileSync(join(path, ".git", "config"), "utf8"));
    Assert.isTrue(existsSync(join(path, ".git", "objects")) && existsSync(join(path, ".git", "refs", "heads")));
  }

  @TestMethod
  public stopsGitsWalkUpAtTheChatsFolderEvenInsideACheckout(): void {
    using directory = new TemporaryDataDirectory();
    const checkout = new GitRepository(join(directory.path, "checkout"));
    const folders = new ChatFolders(join(checkout.path, "data"));
    const path = folders.prepare("c1");
    mkdirSync(join(path, "src"));
    const git = (cwd: string, ...args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });

    const top = (cwd: string): string => resolve(git(cwd, "rev-parse", "--show-toplevel").trim());
    const status = git(path, "status", "--porcelain");

    Assert.areEqual(realpathSync.native(path), realpathSync.native(top(path)));
    Assert.areEqual(realpathSync.native(path), realpathSync.native(top(join(path, "src"))));
    Assert.areEqual(realpathSync.native(checkout.path), realpathSync.native(top(dirname(path))));
    Assert.areEqual("", status);
  }

  @TestMethod
  public async countsTheFilesAtAnyDepthLeavingOutItsGitAndAMissingFolderWithoutHoldingUpOtherWork(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    const path = folders.prepare("c1");
    writeFileSync(join(path, "a.txt"), "a");
    mkdirSync(join(path, "src", "deep"), { recursive: true });
    writeFileSync(join(path, "src", "b.txt"), "b");
    writeFileSync(join(path, "src", "deep", "c.txt"), "c");
    mkdirSync(join(path, "empty"));

    const counting = folders.countFilesAsync("c1");
    let counted = false;
    void counting.then(() => {
      counted = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    Assert.isFalse(counted);

    Assert.areEqual(3, await counting);
    Assert.areEqual(0, await folders.countFilesAsync("c2"));
    folders.prepare("c3");
    Assert.areEqual(0, await folders.countFilesAsync("c3"));
  }

  @TestMethod
  public async copiesEverythingButItsGitIntoTheTargetMergingFoldersTheTargetAlreadyHas(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    const path = folders.prepare("c1");
    writeFileSync(join(path, "a.txt"), "a");
    mkdirSync(join(path, "src", "deep"), { recursive: true });
    writeFileSync(join(path, "src", "deep", "c.txt"), "c");
    const target = join(directory.path, "project");
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src", "kept.txt"), "kept");

    const copies: string[] = [];
    await folders.copyToAsync("c1", target, copies);
    const copied = [readFileSync(join(target, "a.txt"), "utf8"), readFileSync(join(target, "src", "deep", "c.txt"), "utf8")];
    const kept = await ChatFolders.removeCopiesAsync(copies);

    Assert.areEqual("a,c", copied.join(","));
    Assert.areEqual([join(target, "a.txt"), join(target, "src", "deep"), join(target, "src", "deep", "c.txt")].join(","), copies.join(","));
    Assert.areEqual(["src", join("src", "kept.txt")].join(","), readdirSync(target, { recursive: true }).map(String).sort().join(","));
    Assert.areEqual(0, kept.length);
    Assert.isTrue(existsSync(join(path, "a.txt")));
  }

  @TestMethod
  public async refusesTheWholeCopyWhenTheTargetHoldsAPathOfTheSameNameUnlessBothAreFolders(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    const path = folders.prepare("c1");
    writeFileSync(join(path, "a.txt"), "a");
    writeFileSync(join(path, "b.txt"), "b");
    mkdirSync(join(path, "src"));
    writeFileSync(join(path, "src", "c.txt"), "c");
    mkdirSync(join(path, "docs"));
    const target = join(directory.path, "project");
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src", "c.txt"), "theirs");
    writeFileSync(join(target, "docs"), "a file");

    const refused = await Assert.throwsAsync(() => folders.copyToAsync("c1", target, []), ServiceException);

    Assert.areEqual(ErrorCode.Conflict, refused.info.name);
    Assert.areEqual(`docs,${join("src", "c.txt")}`, refused.info.arguments.join(","));
    Assert.areEqual(Resources.formatMoveClash(["docs", join("src", "c.txt")]), refused.info.message);
    Assert.isFalse(existsSync(join(target, "a.txt")) || existsSync(join(target, "b.txt")));
    Assert.areEqual("theirs", readFileSync(join(target, "src", "c.txt"), "utf8"));
  }

  @TestMethod
  public async copiesLinksAsTheyAreSoThatOneToTheChatsOwnFilesStillWorksOnceItsFolderIsGone(): Promise<void> {
    if (process.platform === "win32")
      return;
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    const path = folders.prepare("c1");
    mkdirSync(join(path, "lib"));
    writeFileSync(join(path, "lib", "tool.js"), "tool");
    mkdirSync(join(path, "bin"));
    symlinkSync(join("..", "lib", "tool.js"), join(path, "bin", "tool"), "file");
    const outside = join(directory.path, "outside.txt");
    writeFileSync(outside, "outside");
    symlinkSync(outside, join(path, "outside"), "file");
    const target = join(directory.path, "project");
    mkdirSync(target);

    await folders.copyToAsync("c1", target, []);
    folders.remove("c1");

    Assert.areEqual("tool", readFileSync(join(target, "bin", "tool"), "utf8"));
    Assert.areEqual("outside", readFileSync(join(target, "outside"), "utf8"));
  }

  @TestMethod
  public async refusesTheWholeCopyWhenALinkWouldPointElsewhereOnceMoved(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    const path = folders.prepare("c1");
    mkdirSync(join(path, "lib"));
    writeFileSync(join(path, "lib", "a.txt"), "a");
    symlinkSync(join(path, "lib"), join(path, "absolute"), "junction");
    const links = ["absolute"];
    mkdirSync(join(path, "src"));
    if (process.platform !== "win32") {
      writeFileSync(join(directory.path, "outside.txt"), "outside");
      symlinkSync(join("..", "..", "..", "outside.txt"), join(path, "src", "relative"), "file");
      links.push(join("src", "relative"));
    }
    const target = join(directory.path, "project");
    mkdirSync(target);

    const refused = await Assert.throwsAsync(() => folders.copyToAsync("c1", target, []), ServiceException);

    Assert.areEqual(ErrorCode.Conflict, refused.info.name);
    Assert.areEqual(links.join(","), refused.info.arguments.join(","));
    Assert.areEqual(Resources.formatMoveLinks(links), refused.info.message);
    Assert.areEqual(0, readdirSync(target).length);
  }

  @TestMethod
  public async listsWhatItCopiedBeforeACopyFailsSoRemovingItLeavesTheTargetAsItWasAndTheNextTryCopiesEverything(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    const path = folders.prepare("c1");
    writeFileSync(join(path, "a.txt"), "a");
    mkdirSync(join(path, "src", "deep"), { recursive: true });
    writeFileSync(join(path, "src", "b.txt"), "b");
    writeFileSync(join(path, "src", "deep", "c.txt"), "c");
    const target = join(directory.path, "project");
    mkdirSync(join(target, "src"), { recursive: true });
    writeFileSync(join(target, "src", "kept.txt"), "kept");
    const full = Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" });
    const original = fs.promises.cp;
    fs.promises.cp = new Proxy(original, { apply: (copy, self, args: unknown[]): unknown =>
      args[1] === join(target, "src", "deep", "c.txt") ? Promise.reject(full) : Reflect.apply(copy, self, args) });
    syncBuiltinESMExports();
    const copies: string[] = [];
    let thrown: Error;
    try {
      thrown = await Assert.throwsAsync(() => folders.copyToAsync("c1", target, copies), Error);
    }
    finally {
      fs.promises.cp = original;
      syncBuiltinESMExports();
    }
    const listed = copies.map(t => relative(target, t)).join(",");
    const kept = await ChatFolders.removeCopiesAsync(copies);
    const left = readdirSync(target, { recursive: true }).map(String).sort();

    await folders.copyToAsync("c1", target, []);

    Assert.isTrue(thrown === full);
    Assert.areEqual(["a.txt", join("src", "b.txt"), join("src", "deep")].join(","), listed);
    Assert.areEqual(0, kept.length);
    Assert.areEqual(["src", join("src", "kept.txt")].join(","), left.join(","));
    Assert.areEqual("a", readFileSync(join(target, "a.txt"), "utf8"));
    Assert.areEqual("b", readFileSync(join(target, "src", "b.txt"), "utf8"));
    Assert.areEqual("c", readFileSync(join(target, "src", "deep", "c.txt"), "utf8"));
    Assert.areEqual("kept", readFileSync(join(target, "src", "kept.txt"), "utf8"));
  }

  @TestMethod
  public removesTheFolderWithWhatItHoldsAndNothingWhenItIsMissing(): void {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    writeFileSync(join(folders.prepare("c1"), "a.txt"), "a");

    folders.remove("c1");
    folders.remove("c2");

    Assert.isFalse(existsSync(folders.pathOf("c1")));
    Assert.areEqual(0, folders.list().length);
  }

  @TestMethod
  public listsOnlyTheFoldersUnderChats(): void {
    using directory = new TemporaryDataDirectory();
    const folders = new ChatFolders(directory.path);
    folders.prepare("c1");
    writeFileSync(join(directory.path, "chats", "stray.txt"), "x");

    Assert.areEqual("c1", folders.list().join(","));
  }
}
