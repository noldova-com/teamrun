/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";

import { UpdateException } from "../exceptions/update.exception.js";
import type { IUpdateCheckLock } from "../interfaces/i-update-check-lock.js";
import { Resources } from "../resources.js";

export class UpdateCheckLock implements IUpdateCheckLock {
  private readonly folder: string;
  private readonly file: string;
  private readonly stampAsync: () => Promise<UpdateProcess | null>;
  private readonly isRunningAsync: (holder: UpdateProcess) => Promise<boolean>;
  private held: string | null = null;

  public constructor(folder: string, stampAsync: () => Promise<UpdateProcess | null>, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>) {
    this.folder = folder;
    this.file = join(folder, Resources.updateCheckLockFile);
    this.stampAsync = stampAsync;
    this.isRunningAsync = isRunningAsync;
  }

  public async tryAcquireAsync(): Promise<boolean> {
    const holder = await this.stampAsync();
    if (Object.isNull(holder))
      throw new UpdateException(Resources.updateCheckerUnknown);
    const text = JSON.stringify(holder.toJson());
    await mkdir(this.folder, { recursive: true });
    if (await this.createAsync(text))
      return this.hold(text);
    const current = await readFile(this.file, Resources.textEncoding).catch(() => null);
    if (Object.isNull(current) || await this.isHeldAsync(current) || !await this.removeAsync(current))
      return false;
    return await this.createAsync(text) && this.hold(text);
  }

  public async releaseAsync(): Promise<void> {
    const held = this.held;
    this.held = null;
    if (!Object.isNull(held))
      await this.removeAsync(held);
  }

  private hold(text: string): boolean {
    this.held = text;
    return true;
  }

  private async isHeldAsync(text: string): Promise<boolean> {
    const holder = UpdateCheckLock.parse(text);
    return !Object.isNull(holder) && await this.isRunningAsync(holder);
  }

  private async createAsync(text: string): Promise<boolean> {
    const temporary = this.temporaryName();
    await writeFile(temporary, text);
    const isCreated = await link(temporary, this.file).then(() => true, () => false);
    await rm(temporary, { force: true });
    return isCreated;
  }

  private async removeAsync(text: string): Promise<boolean> {
    const claimed = this.temporaryName();
    if (!await rename(this.file, claimed).then(() => true, () => false))
      return false;
    const isJudged = await readFile(claimed, Resources.textEncoding) === text;
    await (isJudged ? rm(claimed, { force: true }) : rename(claimed, this.file));
    return isJudged;
  }

  private temporaryName(): string {
    return `${this.file}.${randomUUID()}${Resources.temporarySuffix}`;
  }

  private static parse(text: string): UpdateProcess | null {
    try {
      return UpdateProcess.fromJson(JSON.parse(text));
    }
    catch {
      return null;
    }
  }
}
