/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import type { TurnTools } from "@noldova/teamrun.core";

import { Resources } from "../../resources.js";

export class ReadOnlyMcpTools {
  public static async listAsync(tools: TurnTools, signal: AbortSignal): Promise<readonly string[]> {
    return (await tools.host.listToolsAsync(signal)).filter(t => ReadOnlyMcpTools.isReadOnly(t)).map(t => String(t[Resources.nameField]));
  }

  private static isReadOnly(tool: JsonObject): boolean {
    try {
      const reader = JsonReader.fromValue(tool);
      const annotations = reader.hasField(Resources.mcpAnnotationsField) ? reader.readNullableObject(Resources.mcpAnnotationsField) : null;
      return annotations?.hasField(Resources.mcpReadOnlyHintField) === true && annotations.readBoolean(Resources.mcpReadOnlyHintField);
    }
    catch {
      return false;
    }
  }
}
