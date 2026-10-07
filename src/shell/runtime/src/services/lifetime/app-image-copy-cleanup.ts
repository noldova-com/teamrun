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
import type { Writable } from "node:stream";

import "@noldova/teamrun-foundation-core";

import { ProductInfo } from "../../models/product-info.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import { ProcessCommandLine } from "../process/process-command-line.js";

export class AppImageCopyCleanup {
  public static async removeAsync(directory: DataDirectory, diagnostics: Writable): Promise<void> {
    await mkdir(directory.logsFolder, { recursive: true });
    const records = (await readdir(directory.logsFolder)).filter(t => Resources.copyRecordNamePattern.test(t)).map(t => path.join(directory.logsFolder, t));
    await Promise.all(records.map(t => AppImageCopyCleanup.endAsync(t).catch((error: unknown) => {
      diagnostics.write(Resources.formatCopyNotEnded(t, String(error)));
    })));
  }

  private static async endAsync(record: string): Promise<void> {
    const lines = (await readFile(record, Resources.utf8Encoding)).split("\n");
    const mounts = lines.map(t => Resources.copyMountRecord.exec(t)).filter(t => !Object.isNull(t));
    const extractions = lines.map(t => Resources.copyExtractionRecord.exec(t)).filter(t => !Object.isNull(t));
    const holders = [...mounts.map(([, holder = String.empty]) => holder), ...extractions.map(([, holder = String.empty]) => holder)];
    if ((await Promise.all(holders.map(t => AppImageCopyCleanup.isHolderRunningAsync(t)))).includes(true))
      return;
    for (const [, , mounter = String.empty, image = String.empty] of mounts)
      await AppImageCopyCleanup.endMountAsync(mounter, image);
    for (const [, , folder = String.empty] of extractions)
      await AppImageCopyCleanup.removeExtractionAsync(folder);
    await rm(record, { force: true });
  }

  private static async endMountAsync(mounter: string, image: string): Promise<void> {
    if (await ProcessCommandLine.isAppImageMountAsync(mounter, image))
      process.kill(Number(mounter), Resources.copyEndSignal);
  }

  private static async removeExtractionAsync(folder: string): Promise<void> {
    const location = path.resolve(folder);
    if (path.dirname(location) === path.resolve(tmpdir()) && Resources.copyExtractionName.test(path.basename(location)))
      await rm(location, { recursive: true, force: true });
  }

  private static async isHolderRunningAsync(processId: string): Promise<boolean> {
    const commandLine = await ProcessCommandLine.readAsync(processId);
    return commandLine.split(Resources.processArgumentSeparator).includes(`${ProductInfo.current.slug}${Resources.launchNameSuffix}`);
  }
}
