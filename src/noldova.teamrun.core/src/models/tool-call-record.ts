/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import type { ToolCallImage } from "./tool-call-image.js";
import type { ToolCallPermission } from "./tool-call-permission.js";

export class ToolCallRecord {
  public readonly tool: string;
  public readonly input: JsonObject;
  public readonly fields: JsonObject;
  public readonly image: ToolCallImage | null;
  public readonly permission: ToolCallPermission | null;

  public constructor(tool: string, input: JsonObject, fields: JsonObject, image: ToolCallImage | null = null,
    permission: ToolCallPermission | null = null) {
    ArgumentException.throwIfNullOrWhitespace(tool, ProtocolResources.toolField);

    this.tool = tool;
    this.input = input;
    this.fields = fields;
    this.image = image;
    this.permission = permission;
  }

  public isCallOf(tool: JsonValue | undefined, input: JsonValue | undefined): boolean {
    return tool === this.tool && (Object.isUndefined(input) || ToolCallRecord.canonical(input) === ToolCallRecord.canonical(this.input));
  }

  private static canonical(value: JsonValue): string {
    return JSON.stringify(value, (_key, entry: unknown) => Object.isObject(entry) && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).toSorted(([a], [b]) => a.localeCompare(b))) : entry);
  }
}
