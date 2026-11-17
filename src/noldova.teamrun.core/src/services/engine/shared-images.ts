/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import { ErrorCode, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";
import type { ILog } from "../../interfaces/i-log.js";
import { Resources } from "../../resources.js";
import { FileSystemErrors } from "./file-system-errors.js";

export class SharedImages {
  private readonly directory: string;
  private readonly limit: number;
  private readonly lifetime: number;
  private readonly now: () => number;
  private readonly log: ILog | null;
  private readonly sharedUntil: Map<string, number> = new Map();

  public constructor(directory: string, limit: number = Resources.sharedImagesByteLimit, lifetime: number = ProtocolResources.fileShareLifetime,
    now: () => number = Date.now, log: ILog | null = null) {
    this.directory = directory;
    this.limit = limit;
    this.lifetime = lifetime;
    this.now = now;
    this.log = log;
  }

  public keep(bytes: Buffer, mediaType: string): string {
    const extension = Resources.sharedImageExtensions.get(mediaType);
    if (Object.isUndefined(extension))
      throw new ServiceException(ErrorCode.NotFound, Resources.writtenImageNotShared, [mediaType]);
    const name = `${createHash(Resources.sharedImageHash).update(bytes).digest(Resources.hexEncoding)}${extension}`;
    const path = join(this.directory, name);
    const now = this.now();
    if (!existsSync(path)) {
      mkdirSync(this.directory, { recursive: true });
      this.makeRoom(bytes.length, now);
      const partial = `${path}${Resources.partialFileSuffix}`;
      writeFileSync(partial, bytes, { flush: true });
      renameSync(partial, path);
    }
    this.sharedUntil.set(name, now + this.lifetime);
    return path;
  }

  public clean(): void {
    const now = this.now();
    for (const copy of this.copies())
      if (this.freeAt(copy) <= now)
        this.remove(copy.name);
  }

  private makeRoom(size: number, now: number): void {
    const copies = this.copies();
    let total = copies.reduce((t, u) => t + u.size, size);
    for (const copy of copies) {
      if (total <= this.limit || this.freeAt(copy) > now)
        break;
      if (this.remove(copy.name))
        total -= copy.size;
    }
    if (total > this.limit)
      throw new ServiceException(ErrorCode.TooLarge, Resources.formatSharedImagesFull(this.limit), []);
  }

  private copies(): { readonly name: string; readonly size: number; readonly writtenAt: number }[] {
    if (!existsSync(this.directory))
      return [];
    return readdirSync(this.directory, { withFileTypes: true }).filter(t => t.isFile()).map(t => {
      const stat = statSync(join(this.directory, t.name));
      return { name: t.name, size: stat.size, writtenAt: stat.mtimeMs };
    }).sort((t, u) => this.freeAt(t) - this.freeAt(u));
  }

  private freeAt(copy: { readonly name: string; readonly writtenAt: number }): number {
    return Math.max(this.sharedUntil.get(copy.name) ?? 0, copy.writtenAt + this.lifetime);
  }

  private remove(name: string): boolean {
    try {
      rmSync(join(this.directory, name), { force: true });
      this.sharedUntil.delete(name);
      return true;
    }
    catch (error) {
      if (!FileSystemErrors.isFileSystemError(error))
        throw error;
      this.log?.write(Resources.formatSharedImageNotRemoved(name, Resources.formatFailureKind(error)));
      return false;
    }
  }
}
