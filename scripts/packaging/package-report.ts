/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";

export default class PackageReport {
  private static readonly FIELD_COUNT: number = 3;

  public readonly target: string;
  public readonly isSigned: boolean;
  public readonly isChecked: boolean;

  public constructor(target: string, isSigned: boolean, isChecked: boolean) {
    this.target = target;
    this.isSigned = isSigned;
    this.isChecked = isChecked;
  }

  public static parse(value: unknown): PackageReport | null {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).length !== PackageReport.FIELD_COUNT)
      return null;
    const target: unknown = Reflect.get(value, "target");
    const signed: unknown = Reflect.get(value, "signed");
    const checked: unknown = Reflect.get(value, "checked");
    if (typeof target !== "string" || typeof signed !== "boolean" || typeof checked !== "boolean")
      return null;
    return new PackageReport(target, signed, checked);
  }

  public async writeAsync(file: string): Promise<void> {
    await writeFile(file, `${JSON.stringify({ target: this.target, signed: this.isSigned, checked: this.isChecked }, null, 2)}\n`);
  }
}
