/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type { ICheck } from "./interfaces/i-check.ts";

export class VersionFileCheck implements ICheck {
  public static readonly VERSION_FILE: string = "version.json";
  public static readonly MANIFEST_FILE: string = "package.json";
  private static readonly VERSION_FIELD: string = "version";

  private readonly root: string;

  public readonly title: string = "Version file";

  public constructor(root: string) {
    this.root = root;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const released = await this.readVersionAsync(VersionFileCheck.VERSION_FILE, output);
    const built = await this.readVersionAsync(VersionFileCheck.MANIFEST_FILE, output);
    if (released === null || built === null)
      return false;
    if (released !== built) {
      output.write(`${VersionFileCheck.VERSION_FILE} holds the version ${released}, but the root ${VersionFileCheck.MANIFEST_FILE}, whose version the build stamps on every package, holds ${built}; the release reads ${VersionFileCheck.VERSION_FILE}, so both change together.\n`);
      return false;
    }
    output.write(`${VersionFileCheck.VERSION_FILE} and the root ${VersionFileCheck.MANIFEST_FILE} both hold ${released}.\n`);
    return true;
  }

  private async readVersionAsync(file: string, output: Writable): Promise<string | null> {
    let text: string;
    try {
      text = await readFile(path.join(this.root, file), "utf8");
    }
    catch (error) {
      output.write(`The root ${file} can't be read: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
    let fields: unknown;
    try {
      fields = JSON.parse(text);
    }
    catch (error) {
      output.write(`The root ${file} isn't valid JSON: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
    const version: unknown = typeof fields === "object" && fields !== null ? Object.entries(fields).find(([t]) => t === VersionFileCheck.VERSION_FIELD)?.[1] : undefined;
    if (typeof version !== "string") {
      output.write(`The root ${file} holds no version string in its "${VersionFileCheck.VERSION_FIELD}" field, but ${JSON.stringify(version ?? null)}.\n`);
      return null;
    }
    return version;
  }
}
