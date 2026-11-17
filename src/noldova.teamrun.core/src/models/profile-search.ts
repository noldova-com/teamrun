/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isAbsolute } from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class ProfileSearch {
  public readonly folders: readonly string[];
  public readonly entries: readonly string[];
  public readonly skipped: readonly string[];

  public constructor(folders: readonly string[], entries: readonly string[], skipped: readonly string[] = []) {
    if (folders.some(t => !isAbsolute(t)))
      throw new ArgumentException(Resources.profileSearchFolderNotAbsolute, Resources.foldersParameterName);
    if (entries.length === 0 || entries.some(t => String.isNullOrWhitespace(t)))
      throw new ArgumentException(Resources.profileSearchWithoutEntries, Resources.entriesParameterName);
    if (skipped.some(t => !isAbsolute(t)))
      throw new ArgumentException(Resources.profileSearchSkippedNotAbsolute, Resources.skippedParameterName);

    this.folders = [...folders];
    this.entries = [...entries];
    this.skipped = [...skipped];
  }
}
