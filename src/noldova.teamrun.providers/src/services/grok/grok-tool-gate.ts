/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";

import type { IAcpToolGate } from "../../interfaces/i-acp-tool-gate.js";
import { AcpGatedTool } from "../../models/acp-gated-tool.js";
import { AcpMcpTool } from "../../models/acp-mcp-tool.js";
import { Resources } from "../../resources.js";

export class GrokToolGate implements IAcpToolGate {
  public readonly methods: readonly string[] = Resources.xaiHooksRunMethods;

  public metaOf(initialized: JsonReader): JsonObject | null {
    const hooks = GrokToolGate.objectAt(initialized, [Resources.acpCapabilitiesField, Resources.acpMetaField, Resources.xaiHooksField]);
    const decisions = hooks?.toJson()[Resources.xaiHookDecisionsField];
    if (!Array.isArray(decisions) || !decisions.includes(Resources.xaiHookDeny))
      return null;
    return { [Resources.xaiHooksField]: { [Resources.xaiPreToolUseEvent]: [{ [Resources.xaiHookCallbackIdsField]: [Resources.grokReadOnlyHookId] }] } };
  }

  public read(params: JsonReader): AcpGatedTool | null {
    if (params.readOptionalString(Resources.xaiHookEventField) !== Resources.xaiPreToolUseWireEvent)
      return null;
    const id = params.readOptionalString(Resources.xaiToolUseIdField);
    if (Object.isUndefined(id) || String.isNullOrWhitespace(id))
      return null;
    const [server, tool, ...rest] = (params.readOptionalString(Resources.xaiToolNameField) ?? String.empty).split(Resources.xaiMcpToolSeparator);
    return new AcpGatedTool(id, rest.length === 0 ? AcpMcpTool.of(server, tool) : null);
  }

  public readOnly(update: JsonReader): boolean {
    return GrokToolGate.objectAt(update, [Resources.acpMetaField, Resources.xaiToolMetaField])?.toJson()[Resources.xaiReadOnlyField] === true;
  }

  public answer(refusal: string | null): JsonObject {
    return Object.isNull(refusal) ? {} : { [Resources.xaiHookDecisionField]: Resources.xaiHookDeny, [Resources.xaiHookReasonField]: refusal };
  }

  private static objectAt(reader: JsonReader, path: readonly string[]): JsonReader | null {
    try {
      return path.reduce<JsonReader | null>((found, field) => found?.hasField(field) === true ? found.readNullableObject(field) : null, reader);
    }
    catch {
      return null;
    }
  }
}
