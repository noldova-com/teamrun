/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { type PlanStep, PlanStepStatus } from "@noldova/teamrun.protocol";

import type { IAcpToDoListReader } from "../../interfaces/i-acp-to-do-list.reader.js";
import { Resources } from "../../resources.js";
import { PlanDetails } from "../plan-details.js";

export class CursorToDoListReader implements IAcpToDoListReader {
  public readonly methods: readonly string[] = Resources.cursorUpdateToDosMethods;
  private readonly lists: Map<string, readonly JsonObject[]> = new Map();

  public read(params: JsonReader): readonly PlanStep[] {
    const sessionId = params.readNonBlankString(Resources.sessionIdField);
    const sent = params.readObjectArray(Resources.cursorTodosField).map(t => t.toJson());
    const merging = params.toJson()[Resources.cursorMergeField] === true;
    const list = CursorToDoListReader.folded(merging ? this.lists.get(sessionId) ?? [] : [], sent, !merging);
    this.lists.set(sessionId, list);
    return list.filter(t => t[Resources.statusField] !== Resources.acpCancelled)
      .map(t => PlanDetails.step(t[Resources.contentField], PlanDetails.statusOf(Resources.acpPlanStatuses, t[Resources.statusField], PlanStepStatus.Pending), undefined))
      .filter(t => !Object.isNull(t));
  }

  private static folded(kept: readonly JsonObject[], sent: readonly JsonObject[], keepsUnnamed: boolean): readonly JsonObject[] {
    const list = [...kept];
    for (const entry of sent) {
      const id = entry[Resources.idField];
      const index = Object.isString(id) && !String.isNullOrWhitespace(id) ? list.findIndex(t => t[Resources.idField] === id) : null;
      if (Object.isNull(index)) {
        if (keepsUnnamed)
          list.push(entry);
      }
      else if (index < 0)
        list.push(entry);
      else
        list[index] = { ...list[index], ...entry };
    }
    return list;
  }
}
