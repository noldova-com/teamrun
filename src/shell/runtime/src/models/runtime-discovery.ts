/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { DiscoveryFormatException } from "../exceptions/discovery-format.exception.js";
import type { IRuntimeDiscoveryJson } from "../interfaces/i-runtime-discovery-json.js";
import { Resources } from "../resources.js";

export class RuntimeDiscovery {
  public readonly endpoint: string;
  public readonly token: string;
  public readonly processId: number;
  public readonly executablePath: string;
  public readonly productVersion: string;
  public readonly protocolVersion: number;
  public readonly build: string;

  public constructor(
    endpoint: string,
    token: string,
    processId: number,
    executablePath: string,
    productVersion: string,
    protocolVersion: number,
    build: string) {
    ArgumentException.throwIfNullOrWhitespace(endpoint, Resources.endpointParameterName);
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(protocolVersion, Resources.protocolVersionParameterName);
    ArgumentException.throwIfNullOrWhitespace(build, Resources.buildParameterName);

    this.endpoint = endpoint;
    this.token = token;
    this.processId = processId;
    this.executablePath = executablePath;
    this.productVersion = productVersion;
    this.protocolVersion = protocolVersion;
    this.build = build;
  }

  public static fromJson(value: unknown): RuntimeDiscovery {
    if (!Object.isObject(value) || Array.isArray(value))
      throw new DiscoveryFormatException(Resources.discoveryNotObject);
    const formatVersion = "formatVersion" in value ? value.formatVersion : undefined;
    if (formatVersion !== Resources.discoveryFormatVersion)
      throw new DiscoveryFormatException(Resources.formatDiscoveryVersion(formatVersion));

    return new RuntimeDiscovery(
      RuntimeDiscovery.readText("endpoint" in value ? value.endpoint : undefined, Resources.endpointParameterName),
      RuntimeDiscovery.readText("token" in value ? value.token : undefined, Resources.tokenParameterName),
      RuntimeDiscovery.readCount("processId" in value ? value.processId : undefined, Resources.processIdParameterName),
      RuntimeDiscovery.readText("executablePath" in value ? value.executablePath : undefined, Resources.executablePathParameterName),
      RuntimeDiscovery.readText("productVersion" in value ? value.productVersion : undefined, Resources.productVersionParameterName),
      RuntimeDiscovery.readCount("protocolVersion" in value ? value.protocolVersion : undefined, Resources.protocolVersionParameterName),
      RuntimeDiscovery.readText("build" in value ? value.build : undefined, Resources.buildParameterName));
  }

  public toJson(): IRuntimeDiscoveryJson {
    return {
      formatVersion: Resources.discoveryFormatVersion,
      endpoint: this.endpoint,
      token: this.token,
      processId: this.processId,
      executablePath: this.executablePath,
      productVersion: this.productVersion,
      protocolVersion: this.protocolVersion,
      build: this.build
    };
  }

  private static readText(value: unknown, name: string): string {
    if (!Object.isString(value) || String.isNullOrWhitespace(value))
      throw new DiscoveryFormatException(Resources.formatDiscoveryField(name));
    return value;
  }

  private static readCount(value: unknown, name: string): number {
    if (!Object.isNumber(value) || !Number.isSafeInteger(value) || value < 1)
      throw new DiscoveryFormatException(Resources.formatDiscoveryField(name));
    return value;
  }
}
