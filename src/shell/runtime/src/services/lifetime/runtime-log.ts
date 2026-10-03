/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import { Resources } from "../../resources.js";
import { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { LogFile } from "../diagnostics/log-file.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";

export class RuntimeLog {
  private readonly file: LogFile;
  private isClosed: boolean = false;

  public readonly diagnostics: Writable;

  private constructor(file: LogFile) {
    this.file = file;
    this.diagnostics = new Writable({
      decodeStrings: false,
      write: (chunk: string | Buffer, _encoding, callback) => {
        try {
          const text = chunk.toString();
          this.record(text.endsWith(Resources.lineSeparator) ? text.slice(0, -Resources.lineSeparator.length) : text);
          callback();
        }
        catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  public static async openAsync(lock: OwnershipLock, ownStartLogName: string | null, now?: () => Date): Promise<RuntimeLog> {
    lock.requireHeld();
    const directory = lock.dataDirectory;
    await mkdir(directory.logsFolder, { recursive: true });
    const file = new LogFile(directory.runtimeLog, directory.previousRuntimeLog, new DiagnosticRedactor(homedir()), now);
    file.open();
    const log = new RuntimeLog(file);
    const stale = (await readdir(directory.logsFolder)).filter(t => Resources.startLogNamePattern.test(t) && t !== ownStartLogName);
    await Promise.allSettled(stale.map(t => rm(path.join(directory.logsFolder, t))));
    return log;
  }

  public writeLine(text: string): void {
    if (!this.isClosed)
      this.record(text);
  }

  public async closeAsync(): Promise<void> {
    if (this.isClosed)
      return;

    this.isClosed = true;
    await new Promise<void>(resolve => this.diagnostics.end(resolve));
  }

  private record(text: string): void {
    this.file.append(this.file.format(text));
  }
}
