/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { SharedMcpSetting } from "../enums/shared-mcp-setting.js";
import { Resources } from "../resources.js";

export class SharedMcpTeammateSetting {
  public readonly teammateId: string;
  public readonly setting: SharedMcpSetting;

  public constructor(teammateId: string, setting: SharedMcpSetting) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (setting !== SharedMcpSetting.On && setting !== SharedMcpSetting.Off)
      throw new ArgumentException(Resources.invalidSharedMcpTeammateSetting, Resources.settingField);

    this.teammateId = teammateId;
    this.setting = setting;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpTeammateSetting {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpTeammateSetting(reader.readNonBlankString(Resources.teammateIdField),
      reader.readOneOf(Resources.settingField, Object.values(SharedMcpSetting)));
  }

  public toJson(): JsonObject {
    return { [Resources.teammateIdField]: this.teammateId, [Resources.settingField]: this.setting };
  }
}
