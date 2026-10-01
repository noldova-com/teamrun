/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export default class BuildRecord {
  public readonly inputs: string;
  public readonly outputs: readonly string[];

  public constructor(inputs: string, outputs: readonly string[]) {
    this.inputs = inputs;
    this.outputs = [...outputs];
  }

  public async isRecordedAsync(file: string): Promise<boolean> {
    return existsSync(file) && await readFile(file, "utf8") === this.format();
  }

  public async writeAsync(file: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, this.format());
  }

  private format(): string {
    return `inputs ${this.inputs}\n${this.outputs.map(t => `output ${t}\n`).join("")}`;
  }
}
