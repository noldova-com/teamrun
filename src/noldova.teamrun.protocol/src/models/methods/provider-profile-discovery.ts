/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { DiscoveredProfile } from "../discovered-profile.js";

export class ProviderProfileDiscovery {
  public readonly profiles: readonly DiscoveredProfile[];

  public constructor(profiles: readonly DiscoveredProfile[]) {
    this.profiles = [...profiles];
  }

  public static fromJson(value: unknown, path?: string): ProviderProfileDiscovery {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderProfileDiscovery(reader.readObjectArray(Resources.profilesField).map(t => DiscoveredProfile.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.profilesField]: this.profiles.map(t => t.toJson())
    };
  }
}
