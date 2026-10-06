/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductInfo } from "../../models/product-info.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";

export class AppImageCopyCleanup {
  public static async removeAsync(directory: DataDirectory): Promise<void> {
    await mkdir(directory.logsFolder, { recursive: true });
    const records = (await readdir(directory.logsFolder)).filter(t => Resources.copyRecordNamePattern.test(t));
    await Promise.allSettled(records.map(t => AppImageCopyCleanup.endAsync(path.join(directory.logsFolder, t))));
  }

  private static async endAsync(record: string): Promise<void> {
    const lines = (await readFile(record, Resources.utf8Encoding)).split("\n");
    const mounts = lines.map(t => Resources.copyMountRecord.exec(t)).filter(t => !Object.isNull(t));
    const extractions = lines.map(t => Resources.copyExtractionRecord.exec(t)).filter(t => !Object.isNull(t));
    const holders = [...mounts.map(([, holder = ""]) => holder), ...extractions.map(([, holder = ""]) => holder)];
    if ((await Promise.all(holders.map(t => AppImageCopyCleanup.isHolderRunningAsync(t)))).includes(true))
      return;
    for (const [, , mounter = "", image = ""] of mounts)
      await AppImageCopyCleanup.endMountAsync(mounter, image);
    for (const [, , folder = ""] of extractions)
      await AppImageCopyCleanup.removeExtractionAsync(folder);
    await rm(record, { force: true });
  }

  private static async endMountAsync(mounter: string, image: string): Promise<void> {
    const separator = Resources.processArgumentSeparator;
    const mounting = `${separator}${await AppImageCopyCleanup.readCommandLineAsync(mounter)}`;
    if (mounting.endsWith(`${separator}${image}${separator}${Resources.appImageMountOption}${separator}`))
      process.kill(Number(mounter), Resources.copyEndSignal);
  }

  private static async removeExtractionAsync(folder: string): Promise<void> {
    const location = path.resolve(folder);
    if (path.dirname(location) === path.resolve(tmpdir()) && Resources.copyExtractionName.test(path.basename(location)))
      await rm(location, { recursive: true, force: true });
  }

  private static async isHolderRunningAsync(processId: string): Promise<boolean> {
    const commandLine = await AppImageCopyCleanup.readCommandLineAsync(processId);
    return commandLine.split(Resources.processArgumentSeparator).includes(`${ProductInfo.current.slug}${Resources.launchNameSuffix}`);
  }

  private static async readCommandLineAsync(processId: string): Promise<string> {
    try {
      return await readFile(path.join(Resources.processFolder, processId, Resources.commandLineFile), Resources.utf8Encoding);
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === Resources.missingFileCode)
        return "";
      throw error;
    }
  }
}
