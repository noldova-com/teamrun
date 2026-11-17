/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { tmpdir } from "node:os";
import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import type { Provider } from "@noldova/teamrun.protocol";

import type { ISavedImageReader } from "../../interfaces/i-saved-image.reader.js";
import type { SavedImage } from "../../models/saved-image.js";
import { Resources } from "../../resources.js";
import { SavedImageFile } from "../saved-image-file.js";

export class CursorImageReader implements ISavedImageReader {
  private readonly temporaryDirectories: readonly string[];
  private readonly userId: number | null;
  private readonly realPathOf: (path: string) => string | null;

  public constructor(temporaryDirectories: readonly string[] = CursorImageReader.temporaryDirectoriesOf(process.platform),
    userId: number | null = CursorImageReader.userIdOf(process), realPathOf: (path: string) => string | null = t => SavedImageFile.realPathOf(t)) {
    this.temporaryDirectories = temporaryDirectories;
    this.userId = userId;
    this.realPathOf = realPathOf;
  }

  public static temporaryDirectoriesOf(platform: string): readonly string[] {
    return platform === Resources.windowsPlatform ? [tmpdir()] : [tmpdir(), Resources.posixTemporaryDirectory];
  }

  public static userIdOf(running: { readonly getuid?: () => number }): number | null {
    return Object.isUndefined(running.getuid) ? null : running.getuid();
  }

  public read(tool: JsonReader, _sessionId: string, _provider: Provider | null, workingDirectory: string): SavedImage | null {
    const path = tool.toJson()[Resources.cursorFilePathField];
    if (!SavedImageFile.isPlain(path))
      return null;
    const folders = [workingDirectory, ...this.temporaryDirectories].flatMap((t, index) => {
      const real = this.realPathOf(t);
      return Object.isNull(real) ? [] : [{ written: t, real, shared: index > 0 }];
    });
    if (!folders.some(t => SavedImageFile.isInside(t.written, path) || SavedImageFile.isInside(t.real, path)))
      return null;
    const allowed = (realPath: string, owner: number): boolean => folders.some(t => SavedImageFile.isInside(t.real, realPath)
      && (!t.shared || Object.isNull(this.userId) || owner === this.userId));
    const target = this.realPathOf(path);
    return Object.isNull(target) ? null : SavedImageFile.read(path, target, allowed);
  }

  public failureOf(_tool: JsonReader): JsonObject | null {
    return null;
  }
}
