/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { StopPolicy } from "../enums/stop-policy.js";
import { Resources } from "../resources.js";

export class StopRequest {
  private static readonly POLICIES: readonly StopPolicy[] = Object.values(StopPolicy);

  public readonly policy: StopPolicy;

  public constructor(policy: StopPolicy) {
    this.policy = policy;
  }

  public static fromJson(value: unknown, path?: string): StopRequest {
    const reader = JsonReader.fromValue(value, path);
    return new StopRequest(reader.readOneOf(Resources.policyField, StopRequest.POLICIES));
  }

  public toJson(): JsonObject {
    return { [Resources.policyField]: this.policy };
  }
}
