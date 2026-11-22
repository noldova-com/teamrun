/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import type { AcpMcpTool } from "./acp-mcp-tool.js";

export class AcpGatedTool {
  public readonly toolUseId: string;
  public readonly mcp: AcpMcpTool | null;

  public constructor(toolUseId: string, mcp: AcpMcpTool | null) {
    ArgumentException.throwIfNullOrWhitespace(toolUseId, Resources.toolUseIdParameterName);

    this.toolUseId = toolUseId;
    this.mcp = mcp;
  }
}
