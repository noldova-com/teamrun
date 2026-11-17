/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { access, cp, lstat, mkdir, readdir, readlink, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import "@noldova/context.core";
import { ErrorCode } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { Resources } from "../../resources.js";

export class ChatFolders {
  private readonly root: string;

  public constructor(dataDirectory: string) {
    this.root = join(dataDirectory, Resources.chatsDirectoryName);
  }

  public pathOf(conversationId: string): string {
    return join(this.root, conversationId);
  }

  public exists(conversationId: string): boolean {
    return existsSync(this.pathOf(conversationId));
  }

  public prepare(conversationId: string): string {
    const folder = this.pathOf(conversationId);
    const git = join(folder, Resources.gitDirectoryName);
    if (!existsSync(join(git, Resources.gitHeadFileName))) {
      mkdirSync(join(git, Resources.gitObjectsDirectoryName), { recursive: true });
      mkdirSync(join(git, Resources.gitBranchesPath), { recursive: true });
      writeFileSync(join(git, Resources.gitConfigFileName), Resources.chatGitConfig);
      writeFileSync(join(git, Resources.gitHeadFileName), Resources.chatGitHead);
    }
    return folder;
  }

  public list(): readonly string[] {
    if (!existsSync(this.root))
      return [];
    return readdirSync(this.root, { withFileTypes: true }).filter(t => t.isDirectory()).map(t => t.name);
  }

  public async countFilesAsync(conversationId: string): Promise<number> {
    return (await this.entriesOfAsync(conversationId)).filter(t => !t.isDirectory).length;
  }

  public async copyToAsync(conversationId: string, target: string, copies: string[]): Promise<void> {
    const entries = await this.entriesOfAsync(conversationId);
    const clashes: string[] = [];
    for (const entry of entries) {
      const there = await lstat(join(target, entry.path)).catch(() => null);
      if (!Object.isNull(there) && !(entry.isDirectory && there.isDirectory()))
        clashes.push(entry.path);
    }
    if (clashes.length > 0)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatMoveClash(clashes), clashes);
    const folder = this.pathOf(conversationId);
    const links: string[] = [];
    for (const entry of entries)
      if (entry.isLink && await ChatFolders.breaksOnMoveAsync(folder, entry.path))
        links.push(entry.path);
    if (links.length > 0)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatMoveLinks(links), links);
    for (const entry of entries) {
      const copy = join(target, entry.path);
      if (entry.isDirectory && await ChatFolders.existsAsync(copy))
        continue;
      if (entry.isDirectory)
        await mkdir(copy);
      else
        await cp(join(folder, entry.path), copy, { force: false, errorOnExist: true, preserveTimestamps: true, verbatimSymlinks: true });
      copies.push(copy);
    }
  }

  public static async removeCopiesAsync(copies: readonly string[]): Promise<readonly string[]> {
    const kept: string[] = [];
    for (const copy of [...copies].reverse())
      await rm(copy, { recursive: true, force: true, maxRetries: Resources.removeRetries }).catch(() => {
        kept.push(copy);
      });
    return kept;
  }

  public remove(conversationId: string): void {
    rmSync(this.pathOf(conversationId), { recursive: true, force: true, maxRetries: Resources.removeRetries });
  }

  private async entriesOfAsync(conversationId: string): Promise<readonly { readonly path: string; readonly isDirectory: boolean; readonly isLink: boolean }[]> {
    const folder = this.pathOf(conversationId);
    const entries: { readonly path: string; readonly isDirectory: boolean; readonly isLink: boolean }[] = [];
    for (const name of await ChatFolders.namesOfAsync(folder)) {
      const top = await lstat(join(folder, name));
      entries.push({ path: name, isDirectory: top.isDirectory(), isLink: top.isSymbolicLink() });
      if (top.isDirectory())
        for (const t of await readdir(join(folder, name), { recursive: true, withFileTypes: true }))
          entries.push({ path: relative(folder, join(t.parentPath, t.name)), isDirectory: t.isDirectory(), isLink: t.isSymbolicLink() });
    }
    return entries;
  }

  private static async breaksOnMoveAsync(folder: string, path: string): Promise<boolean> {
    const link = await readlink(join(folder, path));
    const inside = `${resolve(dirname(join(folder, path)), link)}${sep}`.startsWith(`${folder}${sep}`);
    return isAbsolute(link) === inside;
  }

  private static async existsAsync(path: string): Promise<boolean> {
    return await access(path).then(() => true, () => false);
  }

  private static async namesOfAsync(folder: string): Promise<readonly string[]> {
    if (!await ChatFolders.existsAsync(folder))
      return [];
    return (await readdir(folder)).filter(t => t !== Resources.gitDirectoryName).sort();
  }
}
