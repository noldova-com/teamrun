/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { delimiter, extname, join } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { GitIgnores } from "@noldova/teamrun.core";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class GitIgnoresTests {
  private static readonly changed: readonly string[] = ["_build/deep/map.js", "base.txt", "debug.log", "kept.log", "src/chat.ts"];
  private static readonly program: string = `git${extname(process.execPath)}`;

  @TestMethod
  public async findsTheIgnoredFilesAndThoseInAnIgnoredFolderButNoTrackedFile(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);

    const found = await new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed);

    Assert.areEqual("_build/deep/map.js,debug.log", [...found].join(","));
  }

  @TestMethod
  public async findsTheRemovedPathsOfAnIgnoredFolderAnIgnoredFileAndAFolderNotIgnoredButNoOtherRemovedPath(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    mkdirSync(join(folder, "pkg"));
    writeFileSync(join(folder, "pkg", "mod.py"), "mod\n");
    writeFileSync(join(folder, "pkg", "trace.log"), "trace\n");
    rmSync(join(folder, "_build"), { recursive: true });
    rmSync(join(folder, "debug.log"));
    rmSync(join(folder, "pkg"), { recursive: true });

    const found = await new GitIgnores().ignoredAsync(folder,
      [...GitIgnoresTests.changed, "pkg/mod.py", "pkg/trace.log", "gone/deep/a.txt", "gone/deep/run.log", "src/gone.ts"]);

    Assert.areEqual("_build/deep/map.js,debug.log,pkg/trace.log,gone/deep/run.log", [...found].join(","));
  }

  @TestMethod
  public async asksGitNothingAboutRemovedTrackedFiles(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    for (const name of ["base.txt", "kept.log", "src/chat.ts"])
      rmSync(join(folder, name));
    const trace = join(directory.path, "trace.txt");

    const found = await GitIgnoresTests.withVariableAsync("GIT_TRACE", trace, () => new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed));

    const traced = readFileSync(trace, "utf8");
    Assert.areEqual("_build/deep/map.js,debug.log", [...found].join(","));
    Assert.areEqual("true false", [traced.includes("ls-files -z --stage"), traced.includes("check-ignore")].map(String).join(" "));
  }

  @TestMethod
  public async ignoresNothingWhenGitCantBeStartedForTheFolder(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);

    const found = await new GitIgnores().ignoredAsync(`${folder}\0`, GitIgnoresTests.changed);

    Assert.areEqual(0, found.size);
  }

  @TestMethod
  public async letsAFailureThatIsntGitsThrough(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    const paths = new UnreadablePaths();
    paths.push(...GitIgnoresTests.changed);

    const thrown = await Assert.throwsAsync(() => new GitIgnores().ignoredAsync(folder, paths), Error);

    Assert.areEqual(UnreadablePaths.refusal, thrown.message);
  }

  @TestMethod
  public async passesOverAPathFolderItCantReadAndFindsGitAfterIt(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    const unreadable = join(directory.path, "x".repeat(300));

    const found = await GitIgnoresTests.withVariableAsync("PATH", [unreadable, String(process.env["PATH"])].join(delimiter),
      () => new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed));

    Assert.areEqual("_build/deep/map.js,debug.log", [...found].join(","));
  }

  @TestMethod
  public async keepsTheListedPathsWhenGitCantCheckTheRemovedOnes(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);

    const found = await new GitIgnores().ignoredAsync(folder, [...GitIgnoresTests.changed, "../outside.log"]);

    Assert.areEqual("_build/deep/map.js,debug.log", [...found].join(","));
  }

  @TestMethod
  public async passesOverMacOSsStandInGitWhenTheActiveDeveloperFolderIsMissing(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    const missing = join(directory.path, "Developer");
    const check = (): Promise<ReadonlySet<string>> => new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed);
    const fromUsrBin = (): Promise<ReadonlySet<string>> => GitIgnoresTests.withVariableAsync("PATH", "/usr/bin", check);

    const passedOver = await GitIgnoresTests.withVariableAsync("DEVELOPER_DIR", missing, fromUsrBin);
    const kept = await GitIgnoresTests.withVariableAsync("DEVELOPER_DIR", null, fromUsrBin);
    const elsewhere = await GitIgnoresTests.withVariableAsync("DEVELOPER_DIR", missing, check);

    const expected: Readonly<Record<string, readonly number[]>> = { darwin: [0, 2], linux: [2, 2, 2], win32: [0, 0, 2] };
    const sizes = [passedOver.size, kept.size, ...process.platform === "darwin" ? [] : [elsewhere.size]];
    Assert.areEqual(JSON.stringify(expected[process.platform]), JSON.stringify(sizes));
  }

  @TestMethod
  public async findsTheIgnoredPathsBesideAChangeInsideASubmodule(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    const inner = join(folder, "inner");
    GitIgnoresTests.git(directory.path, "init", "-q", inner);
    writeFileSync(join(inner, "a.txt"), "inner\n");
    GitIgnoresTests.git(inner, "add", "a.txt");
    GitIgnoresTests.git(inner, "commit", "-qm", "inner");
    GitIgnoresTests.git(folder, "add", "inner");
    GitIgnoresTests.git(folder, "commit", "-qm", "submodule");
    writeFileSync(join(inner, "new.txt"), "new\n");
    rmSync(join(folder, "debug.log"));

    const found = await new GitIgnores().ignoredAsync(folder, ["_build/deep/map.js", "inner/new.txt", "inner/gen/x.txt", "debug.log", "base.txt"]);

    Assert.areEqual("_build/deep/map.js,debug.log", [...found].join(","));
  }

  @TestMethod
  public async runsNeitherTheFoldersFsmonitorProgramNorAGitInTheFolder(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    GitIgnoresTests.git(folder, "config", "core.fsmonitor", "echo ran > fsmonitor-ran.txt");
    writeFileSync(join(folder, GitIgnoresTests.program), "not a program\n");

    const found = await new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed);

    Assert.areEqual("_build/deep/map.js,debug.log", [...found].join(","));
    Assert.isFalse(existsSync(join(folder, "fsmonitor-ran.txt")));
  }

  @TestMethod
  public async ignoresNothingWhenNoGitIsFoundOrTheGitFoundCantStart(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    const programs = join(directory.path, "programs");
    mkdirSync(programs);
    writeFileSync(join(programs, GitIgnoresTests.program), "not a program\n");

    const missing = await GitIgnoresTests.withVariableAsync("PATH", ["relative", join(directory.path, "none")].join(delimiter),
      () => new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed));
    const broken = await GitIgnoresTests.withVariableAsync("PATH", ["relative", programs].join(delimiter),
      () => new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed));

    Assert.areEqual(JSON.stringify([0, 0]), JSON.stringify([missing.size, broken.size]));
  }

  @TestMethod
  public async ignoresNothingWhenGitRunsPastItsTime(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    const never = await GitIgnoresTests.neverAnsweredAsync(directory.path);
    GitIgnoresTests.git(folder, "config", "include.path", never.path);

    let found: ReadonlySet<string>;
    try {
      found = await GitIgnoresTests.withVariableAsync("TEAMRUN_GIT_TIMEOUT_MS", "500",
        () => new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed));
    }
    finally {
      never.close();
    }

    Assert.areEqual(0, found.size);
  }

  @TestMethod
  public async ignoresNothingForACheckStoppedWhileGitRunsAndSettlesOnlyOnceGitHasLeftTheFolder(): Promise<void> {
    const directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);
    const never = await GitIgnoresTests.neverAnsweredAsync(directory.path);
    GitIgnoresTests.git(folder, "config", "include.path", never.path);
    const controller = new AbortController();

    let found: ReadonlySet<string>;
    try {
      const pending = new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed, controller.signal);
      controller.abort();
      found = await pending;
    }
    finally {
      never.close();
    }
    rmSync(directory.path, { recursive: true });

    Assert.areEqual(0, found.size);
  }

  @TestMethod
  public async ignoresNothingForACheckStoppedBeforeItStarts(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);

    const stopped = await new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed, AbortSignal.abort());

    Assert.areEqual(0, stopped.size);
  }

  @TestMethod
  public async findsThePathsOfACheckThatCouldBeStoppedButIsnt(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = GitIgnoresTests.repository(directory.path);

    const found = await new GitIgnores().ignoredAsync(folder, GitIgnoresTests.changed, new AbortController().signal);

    Assert.areEqual("_build/deep/map.js,debug.log", [...found].join(","));
  }

  @TestMethod
  public async ignoresNothingInAFolderOutsideEveryRepository(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "plain");
    mkdirSync(folder);
    writeFileSync(join(folder, "debug.log"), "debug\n");

    const found = await new GitIgnores().ignoredAsync(folder, ["debug.log"]);

    Assert.areEqual(0, found.size);
  }

  @TestMethod
  public async checksNothingWhenNoPathIsGiven(): Promise<void> {
    using directory = new TemporaryDataDirectory();

    const found = await new GitIgnores().ignoredAsync(GitIgnoresTests.repository(directory.path), []);

    Assert.areEqual(0, found.size);
  }

  private static async withVariableAsync<T>(name: string, value: string | null, action: () => Promise<T>): Promise<T> {
    const previous = process.env[name];
    GitIgnoresTests.setVariable(name, value ?? undefined);
    try {
      return await action();
    }
    finally {
      GitIgnoresTests.setVariable(name, previous);
    }
  }

  private static setVariable(name: string, value: string | undefined): void {
    if (value === undefined)
      delete process.env[name];
    else
      process.env[name] = value;
  }

  private static repository(parent: string): string {
    const folder = join(parent, "repo");
    GitIgnoresTests.git(parent, "init", "-q", folder);
    mkdirSync(join(folder, "_build", "deep"), { recursive: true });
    mkdirSync(join(folder, "src"));
    const files: Readonly<Record<string, string>> = { ".gitignore": "/_build/\n*.log\n", "base.txt": "base\n", "kept.log": "kept\n",
      "src/chat.ts": "chat\n", "_build/deep/map.js": "map\n", "debug.log": "debug\n" };
    for (const [name, content] of Object.entries(files))
      writeFileSync(join(folder, name), content);
    GitIgnoresTests.git(folder, "add", ".gitignore", "base.txt", "src/chat.ts");
    GitIgnoresTests.git(folder, "add", "-f", "kept.log");
    GitIgnoresTests.git(folder, "commit", "-qm", "base");
    return folder;
  }

  private static async neverAnsweredAsync(parent: string): Promise<{ readonly path: string; close(): void }> {
    if (process.platform !== "win32") {
      const path = join(parent, "never");
      execFileSync("mkfifo", [path]);
      return { path, close: () => undefined };
    }
    const sockets: Socket[] = [];
    const server = createServer(t => sockets.push(t));
    const path = `\\\\.\\pipe\\teamrun-${randomUUID()}`;
    await new Promise<void>(resolve => server.listen(path, resolve));
    return {
      path: path.replaceAll("\\", "/"),
      close: () => {
        for (const socket of sockets)
          socket.destroy();
        server.close();
      }
    };
  }

  private static git(folder: string, ...args: string[]): void {
    execFileSync("git", ["-c", "user.name=TeamRun", "-c", "user.email=teamrun@example.com", "-c", "protocol.file.allow=always", ...args],
      { cwd: folder, windowsHide: true, stdio: "ignore" });
  }
}

class UnreadablePaths extends Array<string> {
  public static readonly refusal: string = "The paths can't be read.";

  public override filter(): never {
    throw new Error(UnreadablePaths.refusal);
  }
}
