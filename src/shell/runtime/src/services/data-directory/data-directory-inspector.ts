/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";

import { DataDirectoryState } from "../../enums/data-directory-state.js";
import { DataDirectoryInspection } from "../../models/data-directory-inspection.js";
import { Resources } from "../../resources.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";
import type { DataDirectory } from "./data-directory.js";

export class DataDirectoryInspector {
  public static async inspectAsync(dataDirectory: DataDirectory): Promise<DataDirectoryInspection> {
    const entries = existsSync(dataDirectory.root)
      ? (await readdir(dataDirectory.root)).filter(t => !Resources.runtimeEntries.includes(t)).sort()
      : [];
    if (entries.includes(Resources.shellDatabaseFileName))
      return new DataDirectoryInspection(DataDirectoryState.Current, entries);
    return new DataDirectoryInspection(entries.length === 0 ? DataDirectoryState.Empty : DataDirectoryState.PreShell, entries);
  }

  public static async moveAsideAsync(lock: OwnershipLock, moment: Date = new Date()): Promise<string | null> {
    lock.requireHeld();
    const root = lock.dataDirectory.root;
    const inspection = await DataDirectoryInspector.inspectAsync(lock.dataDirectory);
    if (inspection.state !== DataDirectoryState.PreShell)
      return null;

    const destination = Resources.formatMovedFolderName(root, Resources.formatTimestamp(moment));
    await mkdir(destination);
    for (const entry of inspection.entries)
      await rename(path.join(root, entry), path.join(destination, entry));
    return destination;
  }
}
