/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { SharedMcpSetting } from "../../enums/shared-mcp-setting.js";
import { Resources } from "../../resources.js";

export class SharedMcpTeammateSetParams {
  public readonly serverId: string;
  public readonly teammateId: string;
  public readonly setting: SharedMcpSetting;

  public constructor(serverId: string, teammateId: string, setting: SharedMcpSetting) {
    ArgumentException.throwIfNullOrWhitespace(serverId, Resources.serverIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (!Object.values(SharedMcpSetting).includes(setting))
      throw new ArgumentException(Resources.invalidSharedMcpSetting, Resources.settingField);

    this.serverId = serverId;
    this.teammateId = teammateId;
    this.setting = setting;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpTeammateSetParams {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpTeammateSetParams(reader.readNonBlankString(Resources.serverIdField), reader.readNonBlankString(Resources.teammateIdField),
      reader.readOneOf(Resources.settingField, Object.values(SharedMcpSetting)));
  }

  public toJson(): JsonObject {
    return { [Resources.serverIdField]: this.serverId, [Resources.teammateIdField]: this.teammateId, [Resources.settingField]: this.setting };
  }
}
