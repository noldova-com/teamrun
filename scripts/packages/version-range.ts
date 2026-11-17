/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VersionRange {
  private static readonly PATTERN: RegExp = /^>=((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) <((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
  private static readonly SEPARATOR: string = ".";

  public readonly lowest: string;
  public readonly refused: string;

  private constructor(lowest: string, refused: string) {
    this.lowest = lowest;
    this.refused = refused;
  }

  public static parse(text: string): VersionRange | null {
    const match = VersionRange.PATTERN.exec(text);
    if (match === null)
      return null;
    const [, lowest = "", refused = ""] = match;
    return VersionRange.compare(lowest, refused) < 0 ? new VersionRange(lowest, refused) : null;
  }

  public static from(lowest: string): VersionRange {
    const [major = 0, minor = 0] = lowest.split(VersionRange.SEPARATOR).map(Number);
    return new VersionRange(lowest, major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`);
  }

  private static compare(left: string, right: string): number {
    const [a, b] = [left, right].map(t => t.split(VersionRange.SEPARATOR).map(Number));
    const index = [0, 1, 2].find(t => a?.[t] !== b?.[t]);
    return index === undefined ? 0 : (a?.[index] ?? 0) - (b?.[index] ?? 0);
  }

  public get isWritten(): boolean {
    return this.refused === VersionRange.from(this.lowest).refused;
  }

  public includes(version: string): boolean {
    return VersionRange.compare(this.lowest, version) <= 0 && VersionRange.compare(version, this.refused) < 0;
  }

  public startsAtOrJustBelow(version: string): boolean {
    const [major = 0, minor = 0, patch = 0] = version.split(VersionRange.SEPARATOR).map(Number);
    return VersionRange.compare(this.lowest, `${major}.${minor}.${Math.max(0, patch - 1)}`) >= 0;
  }

  public toString(): string {
    return `>=${this.lowest} <${this.refused}`;
  }
}
