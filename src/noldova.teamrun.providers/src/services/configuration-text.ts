/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";
import { open } from "node:fs/promises";

import "@noldova/context.core";

import { ConfigurationUnreadableException } from "../exceptions/configuration-unreadable.exception.js";
import { Resources } from "../resources.js";

export class ConfigurationText {
  public static read(file: string, unreadable: (file: string) => string, tooLarge: (file: string) => string): string | null {
    let text: string | undefined;
    try {
      const descriptor = openSync(file, Resources.readFlag);
      try {
        text = fstatSync(descriptor).size > Resources.maximumConfigurationBytes ? undefined : readFileSync(descriptor, Resources.utf8Encoding);
      }
      finally {
        closeSync(descriptor);
      }
    }
    catch (error) {
      return ConfigurationText.missing(error, file, unreadable);
    }
    return ConfigurationText.bounded(text, file, tooLarge);
  }

  public static async readAsync(file: string, unreadable: (file: string) => string, tooLarge: (file: string) => string): Promise<string | null> {
    let text: string | undefined;
    try {
      const handle = await open(file, Resources.readFlag);
      try {
        text = (await handle.stat()).size > Resources.maximumConfigurationBytes ? undefined : await handle.readFile(Resources.utf8Encoding);
      }
      finally {
        await handle.close();
      }
    }
    catch (error) {
      return ConfigurationText.missing(error, file, unreadable);
    }
    return ConfigurationText.bounded(text, file, tooLarge);
  }

  private static missing(error: unknown, file: string, unreadable: (file: string) => string): null {
    if ((error as NodeJS.ErrnoException).code === Resources.missingFileCode)
      return null;
    throw new ConfigurationUnreadableException(unreadable(file), error);
  }

  private static bounded(text: string | undefined, file: string, tooLarge: (file: string) => string): string {
    if (Object.isUndefined(text))
      throw new ConfigurationUnreadableException(tooLarge(file));
    return text;
  }
}
