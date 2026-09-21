/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class ProtocolVersion {
  public static readonly current: ProtocolVersion = ProtocolVersion.parse(Resources.protocolVersion);
  public readonly major: number;
  public readonly minor: number;

  public constructor(major: number, minor: number) {
    if (!Number.isInteger(major) || major < 0)
      throw new ArgumentOutOfRangeException(Resources.majorField, major);
    if (!Number.isInteger(minor) || minor < 0)
      throw new ArgumentOutOfRangeException(Resources.minorField, minor);

    this.major = major;
    this.minor = minor;
  }

  public static parse(text: string): ProtocolVersion {
    const parts = text.split(Resources.versionSeparator);
    const major = Number(parts[0]);
    const minor = Number(parts[1]);
    if (parts.length !== 2 || !Number.isInteger(major) || !Number.isInteger(minor) || major < 0 || minor < 0)
      throw new ArgumentException(Resources.versionTextInvalid, Resources.versionParameterName);
    return new ProtocolVersion(major, minor);
  }

  public static fromJson(value: unknown, path?: string): ProtocolVersion {
    const reader = JsonReader.fromValue(value, path);
    return new ProtocolVersion(reader.readInteger(Resources.majorField), reader.readInteger(Resources.minorField));
  }

  public canServe(client: ProtocolVersion): boolean {
    return this.equals(client);
  }

  public equals(other: ProtocolVersion): boolean {
    return other.major === this.major && other.minor === this.minor;
  }

  public toJson(): JsonObject {
    return { [Resources.majorField]: this.major, [Resources.minorField]: this.minor };
  }

  public toString(): string {
    return `${this.major}${Resources.versionSeparator}${this.minor}`;
  }
}
