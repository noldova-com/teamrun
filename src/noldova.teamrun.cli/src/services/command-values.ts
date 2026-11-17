/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { type JsonValue, JsonReader } from "@noldova/context.json";
import { CliCommandException, UsageException } from "@noldova/desktop.cli";

import { Resources } from "../resources.js";

export class CommandValues {
  private readonly values: Readonly<Record<string, JsonValue>>;
  private readonly reader: JsonReader;

  public constructor(values: Readonly<Record<string, JsonValue>>) {
    this.values = values;
    this.reader = JsonReader.fromValue(values);
  }

  public readText(name: string): string {
    return this.reader.readString(name);
  }

  public readOptionalText(name: string): string | null {
    return this.reader.readOptionalString(name) ?? null;
  }

  public readFolder(name: string): string {
    const folder = resolve(this.readText(name).replace(Resources.homePattern, homedir()));
    if (statSync(folder, { throwIfNoEntry: false })?.isDirectory() !== true)
      throw new CliCommandException(Resources.notFoundCode, Resources.formatFolderNotFound(folder));

    return folder;
  }

  public readWords(name: string): string {
    return this.reader.readStringArray(name).join(Resources.wordSeparator);
  }

  public readInteger(name: string): number {
    const value = this.values[name];
    if (!Number.isSafeInteger(value))
      throw new UsageException(Resources.formatNotAWholeNumber(name));

    return value as number;
  }

  public readOptionalInteger(name: string): number | null {
    return Object.hasOwn(this.values, name) ? this.readInteger(name) : null;
  }

  public isSet(name: string): boolean {
    return Object.hasOwn(this.values, name);
  }
}
