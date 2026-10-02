/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, createWriteStream, openSync, writeSync } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { Resources } from "../../resources.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";

export class RuntimeLog {
  private readonly descriptor: number;
  private isClosed: boolean = false;

  public readonly diagnostics: Writable;

  private constructor(file: string, descriptor: number) {
    this.descriptor = descriptor;
    this.diagnostics = createWriteStream(file, { fd: descriptor, autoClose: false });
  }

  public static async openAsync(lock: OwnershipLock, ownStartLogName: string | null): Promise<RuntimeLog> {
    lock.requireHeld();
    const directory = lock.dataDirectory;
    await mkdir(directory.logsFolder, { recursive: true });
    await rename(directory.runtimeLog, directory.previousRuntimeLog).catch(() => undefined);
    const log = new RuntimeLog(directory.runtimeLog, openSync(directory.runtimeLog, Resources.writeFlag, Resources.privateFileMode));
    const stale = (await readdir(directory.logsFolder)).filter(t => Resources.startLogNamePattern.test(t) && t !== ownStartLogName);
    await Promise.allSettled(stale.map(t => rm(path.join(directory.logsFolder, t))));
    return log;
  }

  public writeLine(text: string): void {
    if (!this.isClosed)
      writeSync(this.descriptor, `${text}${Resources.lineSeparator}`);
  }

  public async closeAsync(): Promise<void> {
    if (this.isClosed)
      return;

    this.isClosed = true;
    await new Promise<void>(resolve => this.diagnostics.end(resolve));
    closeSync(this.descriptor);
  }
}
