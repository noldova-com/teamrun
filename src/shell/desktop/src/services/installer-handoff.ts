/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";

import "@noldova/teamrun-foundation-core";
import type { IWindowsProcessApi } from "@noldova/teamrun-shell-runtime";

import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import { UpdateController } from "./update-controller.js";

export class InstallerHandoff implements IUpdateHandoff {
  private readonly folder: string;
  private readonly protectAsync: (folder: string) => Promise<void>;
  private readonly files: Pick<IWindowsProcessApi, "openFileForReading" | "closeHandle">;
  private readonly startAsync: (installer: string) => Promise<number>;

  public constructor(
    installationFolder: string,
    protectAsync: (folder: string) => Promise<void>,
    files: Pick<IWindowsProcessApi, "openFileForReading" | "closeHandle">,
    startAsync: (installer: string) => Promise<number>) {
    this.folder = join(installationFolder, Resources.handoffFolder);
    this.protectAsync = protectAsync;
    this.files = files;
    this.startAsync = startAsync;
  }

  public static async clearAsync(installationFolder: string, log: (text: string) => void): Promise<void> {
    await rm(join(installationFolder, Resources.handoffFolder), { recursive: true, force: true })
      .catch((error: unknown) => log(Resources.formatHandoffNotRemoved(String(error))));
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<number> {
    const folder = join(this.folder, randomUUID());
    await mkdir(folder, { recursive: true });
    await this.protectAsync(folder);
    const installer = join(folder, basename(record.file));
    await copyFile(record.file, installer, constants.COPYFILE_EXCL);
    const handle = this.files.openFileForReading(installer);
    if (Object.isNumber(handle))
      throw new UpdateHandoffException(Resources.formatInstallerNotHeld(handle));
    try {
      if (await UpdateController.hashFileAsync(installer) !== record.sha512)
        throw new UpdateHandoffException(Resources.updateChangedBeforeHandoff);
      return await this.startAsync(installer);
    }
    catch (error) {
      this.files.closeHandle(handle);
      throw error;
    }
  }
}
