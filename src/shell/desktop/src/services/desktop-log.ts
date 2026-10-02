/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import type { Writable } from "node:stream";

import type { DataDirectory, DiagnosticRedactor } from "@noldova/teamrun-shell-runtime";

import type { IDesktopLog } from "../interfaces/i-desktop-log.js";
import { Resources } from "../resources.js";

export class DesktopLog implements IDesktopLog {
  private readonly directory: DataDirectory;
  private readonly error: Writable;
  private readonly redactor: DiagnosticRedactor;
  private readonly now: () => Date;
  private isOpen: boolean = false;
  private hasOpened: boolean = false;

  public constructor(directory: DataDirectory, error: Writable, redactor: DiagnosticRedactor, now: () => Date = () => new Date()) {
    this.directory = directory;
    this.error = error;
    this.redactor = redactor;
    this.now = now;
  }

  public open(): void {
    if (this.hasOpened)
      return;
    this.hasOpened = true;
    try {
      if (!existsSync(this.directory.logsFolder))
        mkdirSync(this.directory.logsFolder);
      if (existsSync(this.directory.desktopLog))
        renameSync(this.directory.desktopLog, this.directory.previousDesktopLog);
      writeFileSync(this.directory.desktopLog, "", { mode: Resources.logFileMode });
      this.isOpen = true;
    }
    catch (failure) {
      this.write(Resources.formatDesktopLogUnavailable(String(failure)));
    }
  }

  public write(text: string): void {
    const line = `${this.now().toISOString()} ${this.redactor.redact(text)}${Resources.logLineSeparator}`;
    this.error.write(line);
    if (!this.isOpen)
      return;
    try {
      appendFileSync(this.directory.desktopLog, line);
    }
    catch (failure) {
      this.isOpen = false;
      this.write(Resources.formatDesktopLogUnavailable(String(failure)));
    }
  }
}
