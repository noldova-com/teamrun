/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import type { PlanUsage } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class AccountLimits {
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public async recordAsync(providerId: string, seenAt: string, resetsAt: string | null, transaction?: SqlTransaction): Promise<void> {
    await (transaction ?? this.context.database.connection).executeAsync(new SqlQuery(Resources.upsertAccountLimit, [providerId, seenAt, resetsAt]));
  }

  public async resetOfAsync(providerId: string, transaction?: SqlTransaction): Promise<string | null> {
    const [row] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectAccountLimit, [providerId]));
    return row?.readNullableString(Resources.resetsAtColumn) ?? null;
  }

  public async isOutAsync(providerId: string, now: number, usage: PlanUsage | null, transaction?: SqlTransaction): Promise<boolean> {
    const [row] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectAccountLimit, [providerId]));
    const seenAt = row?.readString(Resources.seenAtColumn) ?? null;
    const later = Object.isNull(usage) || (!Object.isNull(seenAt) && Date.parse(usage.readAt) <= Date.parse(seenAt)) ? null : usage;
    if (later?.usedUp === true)
      return true;
    if (Object.isUndefined(row))
      return false;
    const resetsAt = row.readNullableString(Resources.resetsAtColumn);
    return Object.isNull(resetsAt) ? Object.isNull(later) : Date.parse(resetsAt) > now;
  }
}
