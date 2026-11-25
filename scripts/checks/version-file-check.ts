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

import "@noldova/context.core";

import { VersionSetter } from "../packages/version-setter.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class VersionFileCheck implements ICheck {
  public static readonly VERSION_FILE: string = "version.json";
  private static readonly VERSION_FIELD: string = "version";

  private readonly root: string;

  public readonly title: string = "Version file";

  public constructor(root: string) {
    this.root = root;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const released = await this.readVersionAsync(VersionFileCheck.VERSION_FILE, output);
    let passed = !Object.isNull(released);
    const files = [...VersionSetter.TEXT_FILES.filter(t => t !== VersionFileCheck.VERSION_FILE), ...VersionSetter.MANIFESTS];
    for (const manifest of files) {
      const version = await this.readVersionAsync(manifest, output);
      if (Object.isNull(version))
        passed = false;
      else if (!Object.isNull(released) && version !== released) {
        output.write(`${manifest} holds the version ${version}, but ${VersionFileCheck.VERSION_FILE} holds ${released}; npm run set-version moves only the files that hold ${VersionFileCheck.VERSION_FILE}'s version, and the release compares app/package.json's with the version it builds, so each holds it.\n`);
        passed = false;
      }
    }
    if (passed)
      output.write(`${VersionFileCheck.VERSION_FILE}, ${files.join(", ")} all hold ${released}.\n`);
    return passed;
  }

  private async readVersionAsync(file: string, output: Writable): Promise<string | null> {
    let text: string;
    try {
      text = await readFile(path.join(this.root, file), "utf8");
    }
    catch (error) {
      output.write(`${file} can't be read: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
    let fields: unknown;
    try {
      fields = JSON.parse(text);
    }
    catch (error) {
      output.write(`${file} isn't valid JSON: ${error instanceof Error ? error.message : String(error)}\n`);
      return null;
    }
    const version: unknown = Object.isObject(fields) ? Object.entries(fields).find(([t]) => t === VersionFileCheck.VERSION_FIELD)?.[1] : undefined;
    if (!Object.isString(version)) {
      output.write(`${file} holds no version string in its "${VersionFileCheck.VERSION_FIELD}" field, but ${JSON.stringify(version ?? null)}.\n`);
      return null;
    }
    return version;
  }
}
