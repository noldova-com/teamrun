/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { ConfigurationUnreadableException } from "../../exceptions/configuration-unreadable.exception.js";
import { Resources } from "../../resources.js";
import { ConfigurationText } from "../configuration-text.js";

export class CursorPermissions {
  public static readonly none: CursorPermissions = new CursorPermissions([], []);

  public readonly allow: readonly string[];
  public readonly deny: readonly string[];

  public constructor(allow: readonly string[], deny: readonly string[]) {
    this.allow = [...allow];
    this.deny = [...deny];
  }

  public static read(file: string): CursorPermissions {
    const text = ConfigurationText.read(file, t => Resources.formatCursorConfigUnreadable(t), t => Resources.formatCursorConfigTooLarge(t));
    if (Object.isNull(text))
      return CursorPermissions.none;
    try {
      const config = JsonReader.parse(text);
      if (!config.hasField(Resources.cursorPermissionsField))
        return CursorPermissions.none;
      const permissions = config.readObject(Resources.cursorPermissionsField);
      return new CursorPermissions(CursorPermissions.rules(permissions, Resources.cursorAllowField).filter(t => !CursorPermissions.reachesTeamRun(t)),
        CursorPermissions.rules(permissions, Resources.cursorDenyField));
    }
    catch (error) {
      throw new ConfigurationUnreadableException(Resources.formatCursorConfigUnreadable(file), error);
    }
  }

  private static reachesTeamRun(rule: string): boolean {
    const server = Resources.cursorMcpRuleServer.exec(rule)?.[1]?.trim();
    return !Object.isUndefined(server) && (server.includes(Resources.cursorRuleWildcard) || server.toLowerCase() === ProtocolResources.mcpServerName);
  }

  private static rules(permissions: JsonReader, field: string): readonly string[] {
    return permissions.hasField(field) ? permissions.readStringArray(field) : [];
  }
}
