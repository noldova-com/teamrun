/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";

import type { IFolderProtector } from "../../interfaces/folder-protector.js";
import type { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import { Resources } from "../../resources.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";

export class DiscoveryPublisher {
  private readonly lock: OwnershipLock;
  private readonly protector: IFolderProtector;
  private readonly replaceFileAsync: (from: string, to: string) => Promise<void>;

  public constructor(lock: OwnershipLock, protector: IFolderProtector, replaceFileAsync: (from: string, to: string) => Promise<void> = rename) {
    this.lock = lock;
    this.protector = protector;
    this.replaceFileAsync = replaceFileAsync;
  }

  public async publishAsync(discovery: RuntimeDiscovery): Promise<string> {
    this.lock.requireHeld();
    const directory = this.lock.dataDirectory;
    const created = await mkdir(directory.discoveryFolder, { recursive: true, mode: Resources.privateFolderMode });
    if (!Object.isUndefined(created))
      await this.protector.protectAsync(directory.discoveryFolder);

    const temporary = path.join(directory.discoveryFolder, Resources.formatTemporaryName(Resources.discoveryFileName, randomUUID()));
    await writeFile(temporary, DiscoveryPublisher.format(discovery), {
      encoding: Resources.utf8Encoding,
      flag: Resources.exclusiveWriteFlag,
      mode: Resources.privateFileMode
    });
    await this.replaceAsync(temporary, directory.discoveryFile);
    return directory.discoveryFile;
  }

  public async withdrawAsync(discovery: RuntimeDiscovery): Promise<boolean> {
    this.lock.requireHeld();
    const file = this.lock.dataDirectory.discoveryFile;
    if (!existsSync(file) || await readFile(file, Resources.utf8Encoding) !== DiscoveryPublisher.format(discovery))
      return false;

    await rm(file);
    return true;
  }

  public async withdrawEarlierAsync(): Promise<void> {
    this.lock.requireHeld();
    await rm(this.lock.dataDirectory.discoveryFile, { force: true });
  }

  private async replaceAsync(temporary: string, file: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.replaceFileAsync(temporary, file);
        return;
      }
      catch (error) {
        if (attempt >= Resources.replaceAttempts || !DiscoveryPublisher.isBusy(error)) {
          await rm(temporary, { force: true });
          throw error;
        }
      }
      await delay(Resources.replaceRetryDelay);
    }
  }

  private static isBusy(error: unknown): boolean {
    return Object.isObject(error) && Resources.fileErrorCodeField in error && Resources.busyFileErrorCodes.includes(String(error[Resources.fileErrorCodeField]));
  }

  private static format(discovery: RuntimeDiscovery): string {
    return `${JSON.stringify(discovery.toJson())}${Resources.lineSeparator}`;
  }
}
