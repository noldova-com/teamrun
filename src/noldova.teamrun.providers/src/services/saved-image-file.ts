/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, constants, fstatSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import "@noldova/context.core";

import { SavedImage } from "../models/saved-image.js";
import { Resources } from "../resources.js";
import { ImageDataReader } from "./image-data.reader.js";

export class SavedImageFile {
  private static readonly openFlags: number = constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW;

  public static isPlain(path: unknown): path is string {
    return Object.isString(path) && isAbsolute(path) && !path.split(Resources.pathSeparatorPattern).some(t => Resources.dotSegments.includes(t));
  }

  public static realPathOf(path: string): string | null {
    return SavedImageFile.attempt(() => realpathSync(path));
  }

  public static isInside(directory: string, path: string): boolean {
    const child = relative(directory, path);
    return !isAbsolute(child) && child !== Resources.parentSegment && !child.startsWith(Resources.parentSegment + sep);
  }

  public static read(path: string, target: string, allowed: (realPath: string, owner: number) => boolean): SavedImage | null {
    return SavedImageFile.attempt(() => {
      const found = statSync(target);
      if (!found.isFile())
        return null;
      const file = openSync(target, SavedImageFile.openFlags);
      try {
        const opened = fstatSync(file);
        if (!opened.isFile() || opened.dev !== found.dev || opened.ino !== found.ino || realpathSync(path) !== target || !allowed(target, opened.uid)
          || opened.size === 0 || opened.size > Resources.maximumImageBytes)
          return null;
        const bytes = Buffer.alloc(opened.size);
        const data = bytes.subarray(0, readSync(file, bytes, 0, opened.size, 0)).toString(Resources.acpBase64Encoding);
        const mediaType = ImageDataReader.mediaTypeOf(data);
        return Object.isNull(mediaType) ? null : new SavedImage(path, mediaType, data);
      }
      finally {
        closeSync(file);
      }
    });
  }

  private static attempt<T>(action: () => T): T | null {
    try {
      return action();
    }
    catch {
      return null;
    }
  }
}
