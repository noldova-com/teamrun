/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import { Resources } from "../resources.js";

export class DeviceFileStore implements IDeviceFileStore {
  private readonly folder: string;
  private readonly file: string;
  private writing: Promise<void> = Promise.resolve();

  public constructor(folder: string, fileName: string) {
    ArgumentException.throwIfNullOrWhitespace(fileName, Resources.fileNameParameter);

    this.folder = folder;
    this.file = join(folder, fileName);
  }

  public async readAsync(): Promise<JsonObject | null> {
    if (!existsSync(this.file))
      return null;
    return JsonReader.fromValue(JSON.parse(await readFile(this.file, Resources.textEncoding))).toJson();
  }

  public writeAsync(value: JsonObject): Promise<void> {
    const write = this.writing.catch(() => undefined).then(() => this.writeNowAsync(value));
    this.writing = write;
    return write;
  }

  private async writeNowAsync(value: JsonObject): Promise<void> {
    const temporary = `${this.file}${Resources.temporarySuffix}`;
    await mkdir(this.folder, { recursive: true });
    await writeFile(temporary, JSON.stringify(value), Resources.textEncoding);
    await rename(temporary, this.file);
  }
}
