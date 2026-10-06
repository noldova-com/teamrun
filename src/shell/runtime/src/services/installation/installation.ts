/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import type { UpdateProcess } from "@noldova/teamrun-shell-protocol";

import { UpdateBarrierState } from "../../enums/update-barrier-state.js";
import { UpdateBarrierStatus } from "../../enums/update-barrier-status.js";
import { UpdateBarrier } from "../../models/update-barrier.js";
import { Resources } from "../../resources.js";

export class Installation {
  private readonly isRunningAsync: (holder: UpdateProcess) => Promise<boolean>;

  public readonly folder: string;
  public readonly barrierFile: string;
  public readonly recordFolder: string;

  public constructor(folder: string, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>) {
    this.folder = folder;
    this.barrierFile = path.join(folder, Resources.barrierFileName);
    this.recordFolder = path.join(folder, Resources.dataDirectoriesFolderName);
    this.isRunningAsync = isRunningAsync;
  }

  public static locate(deviceFolder: string, programPath: string): string {
    return path.join(deviceFolder, Resources.installationsFolderName, Installation.digest(path.resolve(programPath)));
  }

  private static digest(text: string): string {
    return createHash(Resources.tokenDigestAlgorithm).update(text).digest(Resources.hexEncoding).slice(0, Resources.installationIdLength);
  }

  public async recordAsync(dataDirectory: string): Promise<void> {
    const root = path.resolve(dataDirectory);
    const file = path.join(this.recordFolder, `${Installation.digest(root)}${Resources.jsonExtension}`);
    const temporary = path.join(this.recordFolder, Resources.formatTemporaryName(path.basename(file), randomUUID()));
    await mkdir(this.recordFolder, { recursive: true });
    await writeFile(temporary, JSON.stringify({ [Resources.dataDirectoryField]: root }));
    await rename(temporary, file);
  }

  public async checkAsync(version: string): Promise<UpdateBarrierStatus> {
    const text = await this.readBarrierAsync();
    if (Object.isNull(text))
      return UpdateBarrierStatus.None;
    const barrier = Installation.parse(text);
    if (Object.isNull(barrier))
      return UpdateBarrierStatus.Unfinished;
    if (await this.isRunningAsync(barrier.holder))
      return UpdateBarrierStatus.Held;
    if (barrier.state === UpdateBarrierState.HandedOff && barrier.version !== version)
      return UpdateBarrierStatus.Unfinished;
    await rm(this.barrierFile, { force: true });
    return UpdateBarrierStatus.None;
  }

  public async isHeldAsync(): Promise<boolean> {
    const text = await this.readBarrierAsync();
    const barrier = Object.isNull(text) ? null : Installation.parse(text);
    return !Object.isNull(barrier) && await this.isRunningAsync(barrier.holder);
  }

  private static parse(text: string): UpdateBarrier | null {
    try {
      return UpdateBarrier.fromJson(JSON.parse(text));
    }
    catch {
      return null;
    }
  }

  private async readBarrierAsync(): Promise<string | null> {
    try {
      return await readFile(this.barrierFile, Resources.utf8Encoding);
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === Resources.missingFileErrorCode)
        return null;
      throw error;
    }
  }
}
