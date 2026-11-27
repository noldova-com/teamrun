/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { DetailKind, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import type { TurnDetail } from "../../models/turn-detail.js";
import { Resources } from "../../resources.js";
import { CommandWrites } from "./command-writes.js";

export class ToolWindows {
  private readonly open: Map<string, number> = new Map();
  private readonly ended: Set<string> = new Set();
  private readonly lasting: Set<string> = new Set();
  private readonly spans: { readonly start: number; readonly end: number }[] = [];
  private readonly reports: JsonObject[] = [];
  private reportedKeys: readonly string[] | null = null;
  private unnamed: number = 0;

  public note(detail: TurnDetail, at: number): void {
    const payload = ToolWindows.isJsonObject(detail.payload) ? detail.payload : null;
    const toolUseId = payload?.[ProtocolResources.toolUseIdField];
    const isTool = detail.kind === DetailKind.Command || detail.kind === DetailKind.FileChange || Object.isString(payload?.[ProtocolResources.toolField]);
    if (!isTool) {
      if (Object.isString(toolUseId))
        this.end(toolUseId, at);
      return;
    }
    if (payload?.[ProtocolResources.readOnlyField] === true)
      return;
    if (!Object.isNull(payload)) {
      this.reports.push(payload);
      this.reportedKeys = null;
    }
    const key = Object.isString(toolUseId) ? toolUseId : detail.providerItemId ?? `${Resources.unnamedToolWindowPrefix}${this.unnamed++}`;
    this.start(key, at);
    if (ToolWindows.keepsRunning(payload))
      this.lasting.add(key);
    if (ToolWindows.hasEnded(payload))
      this.end(key, at);
  }

  public start(key: string, at: number): void {
    if (!this.open.has(key) && !this.ended.has(key))
      this.open.set(key, at);
  }

  public end(key: string, at: number): void {
    if (!this.lasting.has(key))
      this.stop(key, at);
  }

  public close(at: number): void {
    for (const key of [...this.open.keys()])
      this.stop(key, at);
  }

  public covers(path: string, root: string): boolean {
    this.reportedKeys ??= this.reported(root);
    const key = ToolWindows.keyOf(path);
    if (this.reportedKeys.some(t => key === t || key.startsWith(`${t}${sep}`)))
      return true;
    const written = ToolWindows.writtenAt(path, root);
    const slack = Resources.toolWindowSlackMilliseconds;
    const result = Object.isNull(written) || this.spans.some(t => written >= t.start - slack && written <= t.end + slack)
      || [...this.open.values()].some(t => written >= t - slack);
    const file = process.env["TEAMRUN_PROBE_WINDOWS"];
    if (!Object.isUndefined(file) && file !== "") {
      const levels: unknown[] = [];
      for (let current = path; ; current = dirname(current)) {
        try {
          const stats = statSync(current, { throwIfNoEntry: false });
          levels.push(Object.isUndefined(stats) ? [current, "none"] : [current, stats.mtimeMs, stats.ctimeMs, stats.birthtimeMs]);
          if (!Object.isUndefined(stats))
            break;
        }
        catch (error: unknown) {
          levels.push([current, error instanceof Error ? error.message : String(error)]);
        }
        if (current === root || dirname(current) === current)
          break;
      }
      appendFileSync(file, JSON.stringify({ now: Date.now(), pid: process.pid, path, root, written, result, spans: this.spans, open: [...this.open.values()], levels }) + String.fromCharCode(10));
    }
    return result;
  }

  private reported(root: string): readonly string[] {
    const rootKey = ToolWindows.keyOf(root);
    return this.reports.flatMap(t => {
      const files = t[ProtocolResources.filesField];
      const listed = Array.isArray(files) ? files.filter((u): u is string => Object.isString(u)).map(u => isAbsolute(u) ? u : resolve(root, u)) : [];
      return [...listed, ...CommandWrites.targetsOf(t, root).files].map(u => ToolWindows.keyOf(u));
    }).filter(t => t !== rootKey && !rootKey.startsWith(`${t}${sep}`));
  }

  private static keyOf(path: string): string {
    return CommandWrites.folderKey(path).toLowerCase();
  }

  private stop(key: string, at: number): void {
    const start = this.open.get(key);
    if (Object.isUndefined(start))
      return;
    this.open.delete(key);
    this.ended.add(key);
    this.spans.push({ start, end: at });
  }

  private static hasEnded(payload: JsonObject | null): boolean {
    if (Object.isNull(payload))
      return false;
    const status = payload[ProtocolResources.statusField];
    return (Object.isString(status) && Resources.endedToolStatuses.includes(status)) || Object.hasOwn(payload, ProtocolResources.outputField);
  }

  private static keepsRunning(payload: JsonObject | null): boolean {
    if (Object.isNull(payload))
      return false;
    const input = payload[ProtocolResources.inputField];
    return Object.isString(payload[Resources.terminalIdField])
      || (ToolWindows.isJsonObject(input) && input[Resources.runInBackgroundField] === true);
  }

  private static writtenAt(path: string, root: string): number | null {
    for (let current = path; ; current = dirname(current)) {
      const written = ToolWindows.changedAt(current);
      if (!Object.isNull(written))
        return written;
      if (current === root || dirname(current) === current)
        return null;
    }
  }

  private static changedAt(path: string): number | null {
    try {
      const stats = statSync(path, { throwIfNoEntry: false });
      return Object.isUndefined(stats) ? null : Math.max(stats.mtimeMs, stats.ctimeMs);
    }
    catch {
      return null;
    }
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
