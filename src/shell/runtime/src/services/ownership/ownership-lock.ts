/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { DataDirectoryOwnedException } from "../../exceptions/data-directory-owned.exception.js";
import { OwnershipReleasedException } from "../../exceptions/ownership-released.exception.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";

export class OwnershipLock implements Disposable {
  private connection: DatabaseSync | null;

  public readonly dataDirectory: DataDirectory;

  private constructor(dataDirectory: DataDirectory, connection: DatabaseSync) {
    this.connection = connection;
    this.dataDirectory = dataDirectory;
  }

  public static acquire(dataDirectory: DataDirectory): OwnershipLock {
    mkdirSync(dataDirectory.root, { recursive: true });
    const connection = new DatabaseSync(dataDirectory.ownershipDatabase, { timeout: Resources.ownershipWaitMilliseconds });
    try {
      connection.exec(Resources.acquireOwnershipStatement);
    }
    catch (error) {
      connection.close();
      throw OwnershipLock.isBusy(error) ? new DataDirectoryOwnedException(dataDirectory.root, new ExceptionOptions(error)) : error;
    }
    return new OwnershipLock(dataDirectory, connection);
  }

  public static isOwned(dataDirectory: DataDirectory): boolean {
    if (!existsSync(dataDirectory.ownershipDatabase))
      return false;

    const connection = new DatabaseSync(dataDirectory.ownershipDatabase);
    try {
      connection.exec(Resources.acquireOwnershipStatement);
      connection.exec(Resources.rollbackStatement);
      return false;
    }
    catch (error) {
      if (OwnershipLock.isBusy(error))
        return true;
      throw error;
    }
    finally {
      connection.close();
    }
  }

  public get isHeld(): boolean {
    return !Object.isNull(this.connection);
  }

  public requireHeld(): void {
    if (!this.isHeld)
      throw new OwnershipReleasedException();
  }

  public release(): void {
    if (Object.isNull(this.connection))
      return;

    this.connection.exec(Resources.rollbackStatement);
    this.connection.close();
    this.connection = null;
  }

  public [Symbol.dispose](): void {
    this.release();
  }

  private static isBusy(error: unknown): boolean {
    return Object.isObject(error) && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.busyErrorCode;
  }
}
