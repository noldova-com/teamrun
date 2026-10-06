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
import { WireContract } from "../services/wire-contract.js";

export class StopRequest {
  private static readonly FIELDS: readonly string[] = [Resources.policyField, Resources.keepsWhileSharedField];
  private static readonly POLICIES: readonly StopPolicy[] = Object.values(StopPolicy);

  public readonly policy: StopPolicy;
  public readonly keepsWhileShared: boolean;

  public constructor(policy: StopPolicy, keepsWhileShared: boolean = false) {
    this.policy = policy;
    this.keepsWhileShared = keepsWhileShared;
  }

  public static fromJson(value: unknown, path?: string): StopRequest {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, StopRequest.FIELDS);
    return new StopRequest(
      reader.readOneOf(Resources.policyField, StopRequest.POLICIES),
      reader.hasField(Resources.keepsWhileSharedField) ? reader.readBoolean(Resources.keepsWhileSharedField) : false);
  }

  public toJson(): JsonObject {
    return { [Resources.policyField]: this.policy, ...this.keepsWhileShared ? { [Resources.keepsWhileSharedField]: true } : {} };
  }
}
