/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class CapabilityToken {
  private readonly digest: Buffer;

  public readonly value: string;

  public constructor(value: string) {
    ArgumentException.throwIfNullOrWhitespace(value, Resources.tokenParameterName);

    this.value = value;
    this.digest = CapabilityToken.hash(value);
  }

  public static generate(): CapabilityToken {
    return new CapabilityToken(randomBytes(Resources.tokenByteLength).toString(Resources.hexEncoding));
  }

  public matches(candidate: string): boolean {
    return timingSafeEqual(this.digest, CapabilityToken.hash(candidate));
  }

  private static hash(value: string): Buffer {
    return createHash(Resources.tokenDigestAlgorithm).update(value, Resources.utf8Encoding).digest();
  }
}
