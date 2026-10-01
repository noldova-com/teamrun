/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, linkSync, openSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { BackupVerificationException } from "../../exceptions/backup-verification.exception.js";
import { Resources } from "../../resources.js";

export class DatabaseBackup {
  public static async createAsync(source: DatabaseSync, folder: string, name: string): Promise<string> {
    await mkdir(folder, { recursive: true });
    const target = path.join(folder, name);
    const temporary = `${target}${Resources.temporarySuffix}`;
    closeSync(openSync(temporary, Resources.exclusiveWriteFlag, Resources.privateFileMode));
    try {
      const wake = setInterval(() => undefined, Resources.backupWakeMilliseconds);
      try {
        await backup(source, temporary);
      }
      finally {
        clearInterval(wake);
      }
      const copy = new DatabaseSync(temporary);
      try {
        copy.exec(Resources.rollbackJournalStatement);
      }
      finally {
        copy.close();
      }
      DatabaseBackup.verify(temporary);
      linkSync(temporary, target);
      return target;
    }
    finally {
      for (const suffix of Resources.databaseFileSuffixes)
        rmSync(`${temporary}${suffix}`, { force: true });
    }
  }

  public static verify(file: string): void {
    let results: unknown[];
    try {
      const check = new DatabaseSync(file, { readOnly: true });
      try {
        results = check.prepare(Resources.integrityCheckStatement).all().map(t => t[Resources.integrityCheckColumn]);
      }
      finally {
        check.close();
      }
    }
    catch (error) {
      throw new BackupVerificationException(new ExceptionOptions(error));
    }
    if (results.length !== 1 || results[0] !== Resources.integrityOk)
      throw new BackupVerificationException();
  }
}
