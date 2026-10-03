/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, renameSync, writeFileSync } from "node:fs";

import { Resources } from "../../resources.js";
import type { DiagnosticRedactor } from "./diagnostic-redactor.js";

export class LogFile {
  private readonly file: string;
  private readonly previousFile: string;
  private readonly redactor: DiagnosticRedactor;
  private readonly now: () => Date;
  private readonly limit: number;
  private size: number = 0;

  public constructor(
    file: string,
    previousFile: string,
    redactor: DiagnosticRedactor,
    now: () => Date = () => new Date(),
    limit: number = Resources.logSizeLimit) {
    this.file = file;
    this.previousFile = previousFile;
    this.redactor = redactor;
    this.now = now;
    this.limit = limit;
  }

  public format(text: string): string {
    const line = `${this.now().toISOString()} ${this.redactor.redact(text)}`;
    const room = Math.floor(this.limit / Resources.logRecordShare) - Resources.lineSeparator.length;
    return `${line.length > room ? line.slice(0, room) : line}${Resources.lineSeparator}`;
  }

  public open(): void {
    this.replacePrevious();
    writeFileSync(this.file, "", { mode: Resources.privateFileMode });
    this.size = 0;
  }

  public append(line: string): void {
    const length = Buffer.byteLength(line);
    if (this.size > 0 && this.size + length > this.limit)
      this.open();

    appendFileSync(this.file, line, { mode: Resources.privateFileMode });
    this.size += length;
  }

  private replacePrevious(): void {
    try {
      renameSync(this.file, this.previousFile);
    }
    catch {
      return;
    }
  }
}
