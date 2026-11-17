/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class SustainAttempts {
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public async recordAsync(chatId: string, chainId: string, teammateId: string, providerId: string, reason: string, transaction?: SqlTransaction): Promise<void> {
    await (transaction ?? this.context.database.connection).executeAsync(new SqlQuery(Resources.insertSustainAttempt, [chainId, teammateId, providerId, chatId, reason]));
  }

  public async recordedForAsync(chainId: string, teammateId: string, reason: string, transaction?: SqlTransaction): Promise<ReadonlySet<string>> {
    return new Set((await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectSustainAttemptsFor, [chainId, teammateId, reason])))
      .map(t => t.readString(Resources.providerIdColumn)));
  }

  public async triedAsync(chainId: string, teammateId: string, transaction?: SqlTransaction): Promise<ReadonlySet<string>> {
    return new Set((await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectSustainAttempts, [chainId, teammateId])))
      .map(t => t.readString(Resources.providerIdColumn)));
  }
}
