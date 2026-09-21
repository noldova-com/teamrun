/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, existsSync, linkSync, mkdirSync, openSync, rmSync } from "node:fs";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import { Guid } from "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";
import { MigrationCatalog } from "./migrations/migration-catalog.js";

export class DatabaseRecovery {
  public static assertCompatible(applied: readonly string[]): void {
    const known = MigrationCatalog.all;
    if (applied.some((id, index) => known[index]?.id !== id))
      throw new ServiceException(ErrorCode.VersionMismatch, Resources.databaseVersionUnsupported, []);
  }

  public static async prepare(dataDirectory: string): Promise<void> {
    const path = join(dataDirectory, Resources.databaseFileName);
    if (!existsSync(path))
      return;
    const database = new DatabaseSync(path, { readOnly: true });
    let applied: string[];
    try {
      const table = database.prepare(Resources.recoveryFindHistory).get();
      applied = Object.isUndefined(table) ? [] : database.prepare(Resources.recoveryReadHistory).all().map(t => {
        const id = t[Resources.recoveryIdColumn];
        if (!Object.isString(id))
          throw new ServiceException(ErrorCode.VersionMismatch, Resources.databaseVersionUnsupported, []);
        return id;
      });
    }
    finally {
      database.close();
    }
    DatabaseRecovery.assertCompatible(applied);
    if (applied.length > 0 && applied.length < MigrationCatalog.all.length)
      await DatabaseRecovery.createBackup(dataDirectory, Guid.createVersion7().toString());
  }

  public static async createBackup(dataDirectory: string, operationId: string): Promise<string | null> {
    if (!Resources.recoveryOperationPattern.test(operationId))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.recoveryOperationInvalid, []);
    const path = join(dataDirectory, Resources.databaseFileName);
    if (!existsSync(path))
      return null;
    const directory = join(dataDirectory, Resources.recoveryDirectoryName);
    mkdirSync(directory, { recursive: true });
    const target = join(directory, operationId + Resources.recoveryBackupSuffix);
    const temporary = target + Resources.recoveryTemporarySuffix;
    const file = openSync(temporary, Resources.exclusiveWriteFlag, Resources.recoveryFileMode);
    closeSync(file);
    try {
      const database = new DatabaseSync(path, { readOnly: true });
      const wake = setInterval(() => undefined, Resources.recoveryWakeMilliseconds);
      try {
        await backup(database, temporary);
      }
      finally {
        clearInterval(wake);
        database.close();
      }
      const check = new DatabaseSync(temporary, { readOnly: true });
      try {
        const result = check.prepare(Resources.recoveryIntegrityCheck).get();
        if (result?.[Resources.recoveryIntegrityField] !== Resources.recoveryIntegrityOk)
          throw new ServiceException(ErrorCode.Conflict, Resources.recoveryBackupFailed, []);
      }
      finally {
        check.close();
      }
      linkSync(temporary, target);
      return target;
    }
    finally {
      rmSync(temporary, { force: true });
    }
  }
}
