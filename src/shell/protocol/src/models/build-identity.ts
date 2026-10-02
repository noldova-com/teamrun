/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { FailureCode } from "../enums/failure-code.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class BuildIdentity {
  private static readonly FIELDS: readonly string[] = [Resources.productVersionField, Resources.protocolVersionField, Resources.fingerprintField];

  public static readonly supportedProtocolVersion: number = BuildIdentity.parseProtocolVersion(Resources.protocolVersion);

  public readonly productVersion: string;
  public readonly protocolVersion: number;
  public readonly fingerprint: string;

  public constructor(productVersion: string, protocolVersion: number, fingerprint: string) {
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionField);
    if (!Number.isInteger(protocolVersion) || protocolVersion <= 0)
      throw new ArgumentOutOfRangeException(Resources.protocolVersionField, protocolVersion, Resources.protocolVersionInvalid);
    ArgumentException.throwIfNullOrWhitespace(fingerprint, Resources.fingerprintField);

    this.productVersion = productVersion;
    this.protocolVersion = protocolVersion;
    this.fingerprint = fingerprint;
  }

  public static parseProtocolVersion(text: string): number {
    if (!Resources.protocolVersionPattern.test(text))
      throw new ArgumentException(Resources.stampedProtocolVersionInvalid, Resources.textParameterName);

    return Number(text);
  }

  public static fromJson(value: unknown, path?: string): BuildIdentity {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, BuildIdentity.FIELDS);
    return WireContract.create(reader, () => new BuildIdentity(
      reader.readString(Resources.productVersionField),
      reader.readInteger(Resources.protocolVersionField),
      reader.readString(Resources.fingerprintField)));
  }

  public findMismatch(other: BuildIdentity): FailureCode | null {
    if (other.protocolVersion !== this.protocolVersion)
      return FailureCode.UnsupportedVersion;

    if (other.fingerprint !== this.fingerprint || other.productVersion !== this.productVersion)
      return FailureCode.BuildMismatch;

    return null;
  }

  public toJson(): JsonObject {
    return {
      [Resources.productVersionField]: this.productVersion,
      [Resources.protocolVersionField]: this.protocolVersion,
      [Resources.fingerprintField]: this.fingerprint
    };
  }
}
