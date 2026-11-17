/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { TurnDetail } from "@noldova/teamrun.core";
import { DetailKind } from "@noldova/teamrun.protocol";

import type { TerminalToolResult } from "../models/terminal-tool-result.js";
import { Resources } from "../resources.js";

export class TerminalToolReader {
  public static isStepTool(tool: string): boolean {
    return Resources.terminalStepTools.includes(tool);
  }

  public static read(tool: string, input: JsonValue, result: TerminalToolResult | null, payload: JsonObject, id: string,
    parentItemId: string | null = null): TurnDetail {
    const args = TerminalToolReader.objectOf(input);
    const report = result?.report ?? null;
    const command = TerminalToolReader.commandOf(tool, args);
    const title = TerminalToolReader.stringOf(report?.[Resources.terminalTitleKey]);
    const terminalTitle = String.isNullOrWhitespace(title) ? null : title;
    const exitCode = report?.[Resources.terminalExitCodeKey];
    const reported = TerminalToolReader.stringOf(report?.[Resources.terminalStatusKey]);
    const output = Object.isNull(report) ? result?.text ?? String.empty : TerminalToolReader.stringOf(report[Resources.terminalOutputKey]) ?? String.empty;
    const shown = output.length > Resources.maximumCommandOutputLength ? `${Resources.ellipsis}${output.slice(-Resources.maximumCommandOutputLength)}` : output;
    const code = Number.isInteger(exitCode) ? exitCode as number : null;
    const status = Object.isNull(result) ? Resources.inProgressItemStatus
      : result.isError || reported === Resources.killedTerminalStatus ? Resources.failedItemStatus : Resources.completedItemStatus;
    const isRunning = !Object.isNull(reported) && Resources.runningTerminalStatuses.includes(reported);
    return new TurnDetail(DetailKind.Command, Resources.formatTerminalStep(command, shown, code, isRunning), {
      ...payload, tool, command, terminalId: TerminalToolReader.stringOf(args?.[Resources.terminalIdKey]), terminalTitle, exitCode: code, status,
      [Resources.titleField]: Resources.formatTerminalStepTitle(tool, terminalTitle)
    }, id, parentItemId);
  }

  private static commandOf(tool: string, args: JsonObject | null): string {
    if (tool === Resources.terminalRunTool)
      return TerminalToolReader.stringOf(args?.[Resources.terminalCommandKey]) ?? tool;
    const keys = TerminalToolReader.stringOf(args?.[Resources.terminalKeysKey]);
    return Object.isNull(keys) ? tool : JSON.stringify(keys).slice(1, -1);
  }

  private static objectOf(value: JsonValue | undefined): JsonObject | null {
    return Object.isObject(value) && !Array.isArray(value) ? value as JsonObject : null;
  }

  private static stringOf(value: JsonValue | undefined): string | null {
    return Object.isString(value) ? value : null;
  }
}
