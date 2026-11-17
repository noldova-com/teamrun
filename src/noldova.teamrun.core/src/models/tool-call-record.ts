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

export class ToolCallRecord {
  public readonly tool: string;
  public readonly input: JsonObject;
  public readonly fields: JsonObject;
  public readonly image: { readonly data: string; readonly mediaType: string } | null;
  public readonly permission: { readonly id: string; readonly risk: string; readonly decision: string; readonly isRemembered: boolean } | null;

  public constructor(tool: string, input: JsonObject, fields: JsonObject, image: { readonly data: string; readonly mediaType: string } | null = null,
    permission: { readonly id: string; readonly risk: string; readonly decision: string; readonly isRemembered: boolean } | null = null) {
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
