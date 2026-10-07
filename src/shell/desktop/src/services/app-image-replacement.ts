/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { type FileHandle, open, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import { Resources } from "../resources.js";

export class AppImageReplacement {
  private readonly image: string;
  private readonly syncFolderAsync: (folder: string) => Promise<void>;
  private readonly log: (text: string) => void;

  public constructor(image: string, syncFolderAsync: (folder: string) => Promise<void>, log: (text: string) => void) {
    this.image = image;
    this.syncFolderAsync = syncFolderAsync;
    this.log = log;
  }

  public static async syncFolderAsync(folder: string): Promise<void> {
    const handle = await open(folder, Resources.readFlag);
    try {
      await handle.sync();
    }
    finally {
      await handle.close();
    }
  }

  public async replaceAsync(download: string): Promise<void> {
    const [image, mode] = await AppImageReplacement.inspectAsync(this.image);
    const folder = path.dirname(image);
    const name = path.basename(image);
    const part = path.join(folder, Resources.formatAppImagePart(name, randomUUID()));
    const handle = await AppImageReplacement.createAsync(part, folder, name, mode);
    try {
      try {
        await handle.chmod(mode);
        await pipeline(createReadStream(download), handle.createWriteStream({ flush: true }));
      }
      finally {
        await handle.close();
      }
      await rename(part, image);
    }
    catch (error) {
      await rm(part, { force: true });
      throw new UpdateHandoffException(Resources.formatAppImageNotReplaced(image, String(error)), new ExceptionOptions(error));
    }
    await this.syncFolderAsync(folder).catch((error: unknown) => this.log(Resources.formatAppImageFolderNotSynced(folder, String(error))));
  }

  private static async inspectAsync(file: string): Promise<[string, number]> {
    try {
      const image = await realpath(file);
      return [image, (await stat(image)).mode & Resources.permissionBits];
    }
    catch (error) {
      throw new UpdateHandoffException(Resources.formatAppImageUnreadable(file, String(error)), new ExceptionOptions(error));
    }
  }

  private static async createAsync(part: string, folder: string, name: string, mode: number): Promise<FileHandle> {
    try {
      await AppImageReplacement.removeLeftoversAsync(folder, name);
      return await open(part, Resources.createOnlyFlag, mode);
    }
    catch (error) {
      throw new UpdateHandoffException(Resources.formatAppImageFolderUnwritable(folder, String(error)), new ExceptionOptions(error));
    }
  }

  private static async removeLeftoversAsync(folder: string, name: string): Promise<void> {
    const leftovers = (await readdir(folder)).filter(t => {
      const match = Resources.appImagePartPattern.exec(t);
      return match?.[1] === name && Resources.uuidPattern.test(match[2] ?? "");
    });
    for (const leftover of leftovers)
      await rm(path.join(folder, leftover), { force: true });
  }
}
