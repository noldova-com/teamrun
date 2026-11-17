/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessByStdio, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, dirname, extname, isAbsolute, join } from "node:path";
import type { Readable, Writable } from "node:stream";

import "@noldova/context.core";

import { GitCheckException } from "../../exceptions/git-check.exception.js";
import { Resources } from "../../resources.js";

export class GitIgnores {
  public async ignoredAsync(folder: string, paths: readonly string[], signal?: AbortSignal): Promise<ReadonlySet<string>> {
    if (paths.length === 0 || signal?.aborted === true)
      return new Set();
    try {
      const git = GitIgnores.locate();
      if (Object.isNull(git))
        return new Set();
      const isListed = GitIgnores.matcher(GitIgnores.split(await GitIgnores.runAsync(git, folder, Resources.gitListIgnoredArguments, String.empty,
        Resources.gitListedExitCodes, signal)));
      const removed = paths.filter(t => !isListed(t) && !existsSync(join(folder, t)));
      const asked = removed.length === 0 ? [] : await GitIgnores.ignoredRemovedAsync(git, folder, removed, signal)
        .catch((error: unknown) => GitIgnores.unanswered(error, []));
      const isAsked = GitIgnores.matcher(asked);
      return new Set(paths.filter(t => isListed(t) || isAsked(t)));
    }
    catch (error) {
      return GitIgnores.unanswered(error, new Set<string>());
    }
  }

  private static unanswered<T>(error: unknown, nothing: T): T {
    if (error instanceof GitCheckException)
      return nothing;
    throw error;
  }

  private static locate(): string | null {
    const name = `${Resources.gitExecutable}${extname(process.execPath)}`;
    return String(process.env[Resources.pathVariable]).split(delimiter).filter(t => isAbsolute(t)).map(t => join(t, name))
      .find(t => GitIgnores.isProgram(t)) ?? null;
  }

  private static isProgram(path: string): boolean {
    return existsSync(path) && statSync(path).isFile() && !GitIgnores.isStub(path);
  }

  private static isStub(path: string): boolean {
    return !GitIgnores.hasDeveloperFolder() && GitIgnores.standInsOnThisComputer().includes(path);
  }

  private static standInsOnThisComputer(): readonly string[] {
    return Resources.gitStubPaths.filter(() => existsSync(Resources.gitStubMarkerPath));
  }

  private static hasDeveloperFolder(): boolean {
    const chosen = process.env[Resources.developerFolderVariable];
    return Object.isString(chosen) ? existsSync(chosen) : Resources.developerFolders.some(t => existsSync(t));
  }

  private static matcher(listed: readonly string[]): (path: string) => boolean {
    const files = new Set(listed);
    const folders = listed.filter(t => t.endsWith(Resources.checkpointPathSeparator));
    return path => files.has(path) || folders.some(t => path.startsWith(t));
  }

  private static removedTops(folder: string, paths: readonly string[]): readonly string[] {
    const tops = new Set<string>();
    for (const path of paths) {
      let top = path;
      let parent = GitIgnores.parentOf(top);
      while (parent.length > 0 && !existsSync(join(folder, parent))) {
        top = parent;
        parent = GitIgnores.parentOf(top);
      }
      tops.add(top === path ? path : `${top}${Resources.checkpointPathSeparator}`);
    }
    return [...tops];
  }

  private static parentOf(path: string): string {
    return path.slice(0, Math.max(0, path.lastIndexOf(Resources.checkpointPathSeparator)));
  }

  private static async ignoredRemovedAsync(git: string, folder: string, removed: readonly string[],
    signal: AbortSignal | undefined): Promise<readonly string[]> {
    const staged = await GitIgnores.runAsync(git, folder, Resources.gitListStagedArguments, String.empty, Resources.gitListedExitCodes, signal);
    const entries = GitIgnores.split(staged);
    const tracked = new Set(entries.map(t => GitIgnores.stagedPathOf(t)));
    const links = entries.filter(t => t.startsWith(Resources.gitlinkPrefix)).map(t => GitIgnores.stagedPathOf(t));
    const asked = (path: string): boolean => !tracked.has(path)
      && !links.some(u => path.startsWith(`${u}${Resources.checkpointPathSeparator}`));
    const untracked = removed.filter(asked);
    const tops = GitIgnores.removedTops(folder, untracked).filter(asked);
    const ignoredTops = await GitIgnores.checkAsync(git, folder, tops, signal);
    const isTopIgnored = GitIgnores.matcher(ignoredTops);
    const rest = untracked.filter(t => !tops.includes(t) && !isTopIgnored(t));
    return [...ignoredTops, ...await GitIgnores.checkAsync(git, folder, rest, signal)];
  }

  private static stagedPathOf(entry: string): string {
    return entry.slice(entry.indexOf(Resources.gitStagedPathSeparator) + 1);
  }

  private static async checkAsync(git: string, folder: string, paths: readonly string[], signal: AbortSignal | undefined): Promise<readonly string[]> {
    return paths.length === 0 ? [] : GitIgnores.split(await GitIgnores.runAsync(git, folder, Resources.gitCheckIgnoreArguments,
      paths.map(t => `${t}${Resources.nullSeparator}`).join(String.empty), Resources.gitCheckedExitCodes, signal));
  }

  private static split(output: string): readonly string[] {
    return output.split(Resources.nullSeparator).filter(t => t.length > 0);
  }

  private static timeLimit(): number {
    const value = Number(process.env[Resources.gitTimeoutVariable]);
    return Number.isSafeInteger(value) && value > 0 ? value : Resources.gitTimeout;
  }

  private static start(git: string, folder: string, commandArguments: readonly string[]): ChildProcessByStdio<Writable, Readable, null> {
    try {
      return spawn(git, [Resources.gitFolderOption, folder, ...Resources.gitSafeArguments, ...commandArguments], {
        cwd: dirname(git),
        env: { ...process.env, [Resources.gitOptionalLocksVariable]: Resources.gitOptionalLocksDisabled },
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true
      });
    }
    catch {
      throw new GitCheckException();
    }
  }

  private static runAsync(git: string, folder: string, commandArguments: readonly string[], input: string, accepted: readonly number[],
    signal: AbortSignal | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = GitIgnores.start(git, folder, commandArguments);
      let output = String.empty;
      const stop = (): boolean => child.kill();
      const timer = setTimeout(stop, GitIgnores.timeLimit());
      const settle = (code: number | null | Error): void => {
        clearTimeout(timer);
        signal?.removeEventListener(Resources.abortEvent, stop);
        child.stdin.destroy();
        child.stdout.destroy();
        if (accepted.some(t => t === code))
          resolve(output);
        else
          reject(new GitCheckException());
      };
      signal?.addEventListener(Resources.abortEvent, stop, { once: true });
      child.stdout.setEncoding(Resources.utf8Encoding);
      child.stdout.on(Resources.dataEvent, (text: string) => {
        output += text;
      });
      child.stdin.on(Resources.errorEvent, stop);
      child.once(Resources.errorEvent, settle);
      child.once(Resources.closeEvent, settle);
      child.stdin.end(input);
    });
  }
}
