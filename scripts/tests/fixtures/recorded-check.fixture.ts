/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type ICheck from "../../checks/interfaces/i-check.ts";

export default class RecordedCheckFixture implements ICheck {
  private readonly isPassing: boolean;
  private readonly runs: string[];

  public readonly title: string;

  public constructor(title: string, runs: string[], isPassing: boolean = true) {
    this.title = title;
    this.runs = runs;
    this.isPassing = isPassing;
  }

  public runAsync(output: Writable): Promise<boolean> {
    this.runs.push(this.title);
    output.write(`${this.title} ran.\n`);
    return Promise.resolve(this.isPassing);
  }
}
