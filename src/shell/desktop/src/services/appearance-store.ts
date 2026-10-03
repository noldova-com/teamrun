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

import { type JsonObject, JsonReader } from "@noldova/teamrun-foundation-json";

import type { IAppearanceStore } from "../interfaces/i-appearance-store.js";
import { Resources } from "../resources.js";

export class AppearanceStore implements IAppearanceStore {
  private readonly folder: string;
  private readonly file: string;
  private writing: Promise<void> = Promise.resolve();

  public constructor(folder: string) {
    this.folder = folder;
    this.file = join(folder, Resources.appearanceFile);
  }

  public async readAsync(): Promise<JsonObject | null> {
    if (!existsSync(this.file))
      return null;
    return JsonReader.fromValue(JSON.parse(await readFile(this.file, Resources.textEncoding))).toJson();
  }

  public writeAsync(preferences: JsonObject): Promise<void> {
    const write = this.writing.catch(() => undefined).then(() => this.writeNowAsync(preferences));
    this.writing = write;
    return write;
  }

  private async writeNowAsync(preferences: JsonObject): Promise<void> {
    const temporary = `${this.file}${Resources.temporarySuffix}`;
    await mkdir(this.folder, { recursive: true });
    await writeFile(temporary, JSON.stringify(preferences), Resources.textEncoding);
    await rename(temporary, this.file);
  }
}
