/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReleaseException from "./release.exception.ts";

export default class ReleaseVersion {
  private static readonly PATTERN: RegExp = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/u;
  private static readonly TAG_PREFIX: string = "v";

  public readonly text: string;
  private readonly major: number;
  private readonly minor: number;
  private readonly patch: number;

  private constructor(text: string, major: number, minor: number, patch: number) {
    this.text = text;
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  public static parse(text: string, source: string): ReleaseVersion {
    const match = ReleaseVersion.PATTERN.exec(text);
    if (match === null)
      throw new ReleaseException(`${source} must be a plain version such as 0.0.2, not "${text}".`);
    return new ReleaseVersion(text, Number(match[1]), Number(match[2]), Number(match[3]));
  }

  public static parseTag(tag: string, source: string): ReleaseVersion {
    if (!tag.startsWith(ReleaseVersion.TAG_PREFIX))
      throw new ReleaseException(`${source} must be a tag such as v0.0.2, not "${tag}".`);
    return ReleaseVersion.parse(tag.slice(ReleaseVersion.TAG_PREFIX.length), source);
  }

  public get tag(): string {
    return `${ReleaseVersion.TAG_PREFIX}${this.text}`;
  }

  public isNewerThan(other: ReleaseVersion): boolean {
    if (this.major !== other.major)
      return this.major > other.major;
    if (this.minor !== other.minor)
      return this.minor > other.minor;
    return this.patch > other.patch;
  }
}
