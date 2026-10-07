/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync } from "node:fs";
import type { Writable } from "node:stream";

import { type DataDirectory, type DiagnosticRedactor, LogFile } from "@noldova/teamrun-shell-runtime";

import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import { Resources } from "../resources.js";

export class DesktopLog implements IDesktopLog {
  private readonly directory: DataDirectory;
  private readonly error: Writable;
  private readonly file: LogFile;
  private readonly kept: string[] = [];
  private isOpen: boolean = false;
  private hasOpened: boolean = false;

  public constructor(directory: DataDirectory, error: Writable, redactor: DiagnosticRedactor, now: () => Date = () => new Date()) {
    this.directory = directory;
    this.error = error;
    this.file = new LogFile(directory.desktopLog, directory.previousDesktopLog, redactor, now);
  }

  public open(): void {
    if (this.hasOpened)
      return;
    this.hasOpened = true;
    try {
      if (!existsSync(this.directory.logsFolder))
        mkdirSync(this.directory.logsFolder);
      this.file.open();
      this.isOpen = true;
    }
    catch (failure) {
      this.write(Resources.formatDesktopLogUnavailable(String(failure)));
    }
    for (const line of this.kept.splice(0))
      this.append(line);
  }

  public write(text: string): void {
    const line = this.file.format(text);
    this.error.write(line);
    this.append(line);
  }

  public writeKept(text: string): void {
    const line = this.file.format(text);
    this.error.write(line);
    if (this.hasOpened)
      this.append(line);
    else
      this.kept.push(line);
  }

  private append(line: string): void {
    if (!this.isOpen)
      return;
    try {
      this.file.append(line);
    }
    catch (failure) {
      this.isOpen = false;
      this.write(Resources.formatDesktopLogUnavailable(String(failure)));
    }
  }
}
