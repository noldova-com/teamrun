/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import "@noldova/context.core";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import { type PlanStep, PlanStepStatus, type Provider } from "@noldova/teamrun.protocol";

import type { IAcpToDoReader } from "../../interfaces/i-acp-to-do.reader.js";
import { Resources } from "../../resources.js";
import { PlanDetails } from "../plan-details.js";

export class CopilotToDoReader implements IAcpToDoReader {
  private readonly defaultProfileDirectory: string;

  public constructor(defaultProfileDirectory: string) {
    this.defaultProfileDirectory = defaultProfileDirectory;
  }

  public read(tool: JsonReader, sessionId: string, provider: Provider | null): readonly PlanStep[] | null {
    const query = CopilotToDoReader.fieldOf(tool.toJson()[Resources.acpRawInputField], Resources.queryField);
    const output = CopilotToDoReader.fieldOf(tool.toJson()[Resources.acpRawOutputField], Resources.copilotDetailedContentField);
    if (!Object.isString(query) || !Resources.copilotToDoWritePattern.test(query) || !Object.isString(output) || !output.startsWith(Resources.copilotSqlOutputPrefix)
      || basename(sessionId) !== sessionId || Resources.dotSegments.includes(sessionId))
      return null;
    const rows = CopilotToDoReader.rowsOf(join(provider?.profileDir ?? this.defaultProfileDirectory, Resources.copilotSessionStateFolderName, sessionId,
      Resources.copilotSessionDatabaseName));
    return rows?.map(t => PlanDetails.step(t[Resources.titleField],
      PlanDetails.statusOf(Resources.copilotToDoStatuses, t[Resources.statusField], PlanStepStatus.Pending), undefined)).filter(t => !Object.isNull(t)) ?? null;
  }

  private static fieldOf(value: JsonValue | undefined, field: string): JsonValue | undefined {
    return Object.isObject(value) && !Array.isArray(value) ? (value as JsonObject)[field] : undefined;
  }

  private static rowsOf(path: string): readonly Record<string, unknown>[] | null {
    try {
      const database = new DatabaseSync(path, { readOnly: true, timeout: Resources.copilotToDoBusyTimeout });
      try {
        return database.prepare(Resources.copilotToDoQuery).all(Resources.maximumSummaryLength, Resources.maximumCopilotToDos);
      }
      finally {
        database.close();
      }
    }
    catch {
      return null;
    }
  }
}
