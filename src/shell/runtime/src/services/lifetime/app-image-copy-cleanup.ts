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
  public static async removeAsync(directory: DataDirectory, ownStartLogName: string | null): Promise<void> {
    await mkdir(directory.logsFolder, { recursive: true });
    const stale = (await readdir(directory.logsFolder)).filter(t => Resources.startLogNamePattern.test(t) && t !== ownStartLogName);
    const texts = await Promise.allSettled(stale.map(t => readFile(path.join(directory.logsFolder, t), Resources.utf8Encoding)));
    const records = texts.flatMap(t => t.status === "fulfilled" ? t.value.split("\n") : []);
    await Promise.allSettled(records.map(t => AppImageCopyCleanup.endAsync(t)));
  }

  private static async endAsync(record: string): Promise<void> {
    const mount = Resources.copyMountRecord.exec(record);
    if (!Object.isNull(mount)) {
      const [, holder = "", mounter = "", image = ""] = mount;
      const separator = Resources.commandLineSeparator;
      const mounting = `${separator}${await AppImageCopyCleanup.readCommandLineAsync(mounter)}`;
      if (!await AppImageCopyCleanup.isHolderRunningAsync(holder) && mounting.endsWith(`${separator}${image}${separator}${Resources.appImageMountOption}${separator}`))
        process.kill(Number(mounter), Resources.copyEndSignal);
      return;
    }
    const extraction = Resources.copyExtractionRecord.exec(record);
    if (Object.isNull(extraction))
      return;
    const [, holder = "", folder = ""] = extraction;
    const location = path.resolve(folder);
    if (path.dirname(location) === path.resolve(tmpdir()) && Resources.copyExtractionName.test(path.basename(location)) && !await AppImageCopyCleanup.isHolderRunningAsync(holder))
      await rm(location, { recursive: true, force: true });
  }

  private static async isHolderRunningAsync(processId: string): Promise<boolean> {
    const commandLine = await AppImageCopyCleanup.readCommandLineAsync(processId);
    return commandLine.split(Resources.commandLineSeparator).includes(`${ProductInfo.current.slug}${Resources.launchNameSuffix}`);
  }

  private static readCommandLineAsync(processId: string): Promise<string> {
    return readFile(path.join(Resources.processFolder, processId, Resources.commandLineFile), Resources.utf8Encoding).catch(() => "");
  }
}
