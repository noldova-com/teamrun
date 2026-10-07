/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync, rmSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Installation } from "@noldova/teamrun-shell-runtime";

import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import { Resources } from "../resources.js";

export class RestartArguments {
  private readonly file: string;

  public constructor(temporaryFolder: string, programPath: string, platform: string) {
    this.file = join(temporaryFolder, Resources.formatRestartArgumentsFile(basename(Installation.locate(temporaryFolder, programPath, platform))));
  }

  public async writeAsync(version: string, launchArguments: readonly string[], written: number): Promise<void> {
    try {
      await writeFile(this.file, JSON.stringify({
        [Resources.restartVersionField]: version,
        [Resources.restartArgumentsField]: launchArguments,
        [Resources.restartWrittenField]: written
      }));
    }
    catch (error) {
      throw new UpdateHandoffException(Resources.restartArgumentsNotWritten, new ExceptionOptions(error));
    }
  }

  public removeAsync(): Promise<void> {
    return rm(this.file, { force: true });
  }

  public take(version: string, now: number): readonly string[] {
    let target: string;
    let launchArguments: readonly string[];
    let written: number;
    try {
      const text = readFileSync(this.file, Resources.textEncoding);
      rmSync(this.file, { force: true });
      const reader = JsonReader.parse(text);
      target = reader.readString(Resources.restartVersionField);
      launchArguments = reader.readStringArray(Resources.restartArgumentsField);
      written = reader.readNumber(Resources.restartWrittenField);
    }
    catch {
      return [];
    }
    const isCurrent = target === version && written <= now && now - written <= Resources.restartArgumentsLimit;
    return isCurrent && launchArguments.every(t => Resources.handoverArguments.some(u => t.startsWith(u))) ? launchArguments : [];
  }
}
