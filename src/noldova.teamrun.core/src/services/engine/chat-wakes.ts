/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";

import type { ChatWakeState } from "../../enums/chat-wake-state.js";
import type { ILog } from "../../interfaces/i-log.js";
import { ChatWake } from "../../models/chat-wake.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class ChatWakes {
  private readonly context: DatabaseContext;
  private readonly log: ILog | null;
  private readonly skipped: Set<string> = new Set();

  public constructor(context: DatabaseContext, log: ILog | null) {
    this.context = context;
    this.log = log;
  }

  public async addAsync(wake: ChatWake, transaction?: SqlTransaction): Promise<void> {
    await (transaction ?? this.context.database.connection).executeAsync(new SqlQuery(Resources.insertChatWake,
      [wake.id, wake.chatId, wake.state, JSON.stringify(wake.toJson()), new Date().toISOString()]));
  }

  public async updateAsync(wake: ChatWake, transaction: SqlTransaction): Promise<void> {
    await transaction.executeAsync(new SqlQuery(Resources.updateChatWake,
      [wake.state, JSON.stringify(wake.toJson()), new Date().toISOString(), wake.id]));
  }

  public async listAsync(state: ChatWakeState, transaction?: SqlTransaction): Promise<readonly ChatWake[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectChatWakes, [state]))).flatMap(t => {
      try {
        return [ChatWake.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson())];
      }
      catch (error) {
        const id = t.readString(Resources.idColumn);
        if (!this.skipped.has(id))
          this.log?.write(Resources.formatChatWakeSkipped(id, Resources.formatFailureKind(error)));
        this.skipped.add(id);
        return [];
      }
    });
  }
}
