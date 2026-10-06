/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { link, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";

import { UpdateBarrierState } from "../../enums/update-barrier-state.js";
import { UpdateBarrierStatus } from "../../enums/update-barrier-status.js";
import { UpdateBarrier } from "../../models/update-barrier.js";
import { Resources } from "../../resources.js";

export class Installation {
  private readonly isRunningAsync: (holder: UpdateProcess) => Promise<boolean>;

  public readonly folder: string;
  public readonly barrierFile: string;
  public readonly recordFolder: string;
  public readonly desktopFolder: string;

  public constructor(folder: string, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>) {
    this.folder = folder;
    this.barrierFile = path.join(folder, Resources.barrierFileName);
    this.recordFolder = path.join(folder, Resources.dataDirectoriesFolderName);
    this.desktopFolder = path.join(folder, Resources.desktopsFolderName);
    this.isRunningAsync = isRunningAsync;
  }

  public static locate(deviceFolder: string, programPath: string, platform: string): string {
    const canonical = Installation.canonicalize(programPath);
    return path.join(deviceFolder, Resources.installationsFolderName, Installation.digest(platform === Resources.windowsPlatform ? canonical.toLowerCase() : canonical));
  }

  private static canonicalize(file: string): string {
    try {
      return realpathSync.native(file);
    }
    catch {
      return path.resolve(file);
    }
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

  public async listDataDirectoriesAsync(): Promise<readonly string[]> {
    const files = await Installation.unlessMissingAsync(readdir(this.recordFolder)) ?? [];
    const roots = await Promise.all(files.filter(t => t.endsWith(Resources.jsonExtension)).map(t => Installation.readEntryAsync(path.join(this.recordFolder, t))));
    return roots.filter(t => !Object.isNull(t));
  }

  public async recordDesktopAsync(desktop: UpdateProcess): Promise<void> {
    const file = path.join(this.desktopFolder, `${desktop.processId}${Resources.jsonExtension}`);
    const temporary = path.join(this.desktopFolder, Resources.formatTemporaryName(path.basename(file), randomUUID()));
    await mkdir(this.desktopFolder, { recursive: true });
    await writeFile(temporary, JSON.stringify(desktop.toJson()));
    await rename(temporary, file);
  }

  public async listDesktopsAsync(): Promise<readonly UpdateProcess[]> {
    const files = await Installation.unlessMissingAsync(readdir(this.desktopFolder)) ?? [];
    const desktops = await Promise.all(files.filter(t => t.endsWith(Resources.jsonExtension)).map(t => this.readDesktopAsync(path.join(this.desktopFolder, t))));
    return desktops.filter(t => !Object.isNull(t));
  }

  public async holdAsync(barrier: UpdateBarrier, version: string): Promise<boolean> {
    if (await this.checkAsync(version) !== UpdateBarrierStatus.None)
      return false;
    await mkdir(this.folder, { recursive: true });
    const temporary = await this.writeTemporaryAsync(barrier);
    let isHeld = false;
    try {
      await link(temporary, this.barrierFile);
      isHeld = true;
    }
    catch (error) {
      if (!Installation.hasCode(error, Resources.existingFileErrorCode))
        throw error;
    }
    finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
    return isHeld;
  }

  public async replaceAsync(barrier: UpdateBarrier): Promise<void> {
    await rename(await this.writeTemporaryAsync(barrier), this.barrierFile);
  }

  public async releaseAsync(): Promise<void> {
    await rm(this.barrierFile, { force: true });
  }

  public async readAsync(): Promise<UpdateBarrier | null> {
    const text = await this.readBarrierAsync();
    return Object.isNull(text) ? null : UpdateBarrier.fromJson(JSON.parse(text));
  }

  public readTextAsync(): Promise<string | null> {
    return this.readBarrierAsync();
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
      return !Object.isNull(barrier.handoff) && await this.isRunningAsync(barrier.handoff) ? UpdateBarrierStatus.Held : UpdateBarrierStatus.Unfinished;
    return await this.removeStaleAsync(text, version);
  }

  public async hasEndedAsync(): Promise<boolean> {
    const text = await this.readBarrierAsync();
    if (Object.isNull(text))
      return true;
    const barrier = UpdateBarrier.fromJson(JSON.parse(text));
    return barrier.state !== UpdateBarrierState.HandedOff && !await this.isRunningAsync(barrier.holder);
  }

  public async removeAsync(text: string): Promise<boolean> {
    const claimed = path.join(this.folder, Resources.formatTemporaryName(Resources.barrierFileName, randomUUID()));
    if (Object.isNull(await Installation.unlessMissingAsync(rename(this.barrierFile, claimed).then(() => claimed))))
      return true;
    const isJudged = await readFile(claimed, Resources.utf8Encoding) === text;
    if (!isJudged)
      await Installation.putBackAsync(claimed, this.barrierFile);
    await rm(claimed, { force: true });
    return isJudged;
  }

  private async removeStaleAsync(text: string, version: string): Promise<UpdateBarrierStatus> {
    return await this.removeAsync(text) ? UpdateBarrierStatus.None : await this.checkAsync(version);
  }

  private static async putBackAsync(claimed: string, file: string): Promise<void> {
    try {
      await link(claimed, file);
    }
    catch (error) {
      if (!Installation.hasCode(error, Resources.existingFileErrorCode))
        throw error;
    }
  }

  private static parse(text: string): UpdateBarrier | null {
    try {
      return UpdateBarrier.fromJson(JSON.parse(text));
    }
    catch {
      return null;
    }
  }

  private async writeTemporaryAsync(barrier: UpdateBarrier): Promise<string> {
    const temporary = path.join(this.folder, Resources.formatTemporaryName(Resources.barrierFileName, randomUUID()));
    await writeFile(temporary, JSON.stringify(barrier.toJson()));
    return temporary;
  }

  private static async readEntryAsync(file: string): Promise<string | null> {
    let root: string;
    try {
      root = JsonReader.fromValue(JSON.parse(await readFile(file, Resources.utf8Encoding))).readString(Resources.dataDirectoryField);
    }
    catch {
      return null;
    }
    return existsSync(root) ? root : null;
  }

  private async readDesktopAsync(file: string): Promise<UpdateProcess | null> {
    const text = await Installation.unlessMissingAsync(readFile(file, Resources.utf8Encoding));
    const desktop = Object.isNull(text) ? null : Installation.parseDesktop(text);
    if (Object.isNull(desktop))
      return null;
    if (await this.isRunningAsync(desktop))
      return desktop;
    await rm(file, { force: true });
    return null;
  }

  private static parseDesktop(text: string): UpdateProcess | null {
    try {
      return UpdateProcess.fromJson(JSON.parse(text));
    }
    catch {
      return null;
    }
  }

  private readBarrierAsync(): Promise<string | null> {
    return Installation.unlessMissingAsync(readFile(this.barrierFile, Resources.utf8Encoding));
  }

  private static async unlessMissingAsync<T>(operation: Promise<T>): Promise<T | null> {
    try {
      return await operation;
    }
    catch (error) {
      if (Installation.hasCode(error, Resources.missingFileErrorCode))
        return null;
      throw error;
    }
  }

  private static hasCode(error: unknown, code: string): boolean {
    return error instanceof Error && "code" in error && error.code === code;
  }
}
