/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import type { DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { MessageDelivery, WaitingMessage } from "@noldova/teamrun.protocol";

import type { ILog } from "../../interfaces/i-log.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class WaitingMessages {
  private readonly context: DatabaseContext;
  private readonly log: ILog | null;
  private readonly skipped: Set<string> = new Set();

  public constructor(context: DatabaseContext, log: ILog | null) {
    this.context = context;
    this.log = log;
  }

  public async addAsync(message: WaitingMessage, transaction?: SqlTransaction): Promise<void> {
    await (transaction ?? this.context.database.connection).executeAsync(new SqlQuery(Resources.insertWaitingMessage,
      [message.id, message.chatId, JSON.stringify(message.toJson()), new Date().toISOString()]));
  }

  public async updateAsync(message: WaitingMessage, transaction: SqlTransaction): Promise<void> {
    await transaction.executeAsync(new SqlQuery(Resources.updateWaitingMessage,
      [JSON.stringify(message.toJson()), new Date().toISOString(), message.id]));
  }

  public async removeAsync(id: string, transaction: SqlTransaction): Promise<void> {
    await transaction.executeAsync(new SqlQuery(Resources.deleteWaitingMessage, [id]));
  }

  public async findAsync(id: string, transaction: SqlTransaction): Promise<WaitingMessage | null> {
    return this.read(await transaction.queryAsync(new SqlQuery(Resources.selectWaitingMessage, [id])))[0] ?? null;
  }

  public async listAsync(chatId: string, transaction?: SqlTransaction): Promise<readonly WaitingMessage[]> {
    const messages = this.read(await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectWaitingMessages, [chatId])));
    return [...messages.filter(t => t.delivery === MessageDelivery.StopAndSend), ...messages.filter(t => t.delivery !== MessageDelivery.StopAndSend)];
  }

  public async idsAsync(transaction?: SqlTransaction): Promise<readonly string[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectWaitingIds, []))).map(t => t.readString(Resources.idColumn));
  }

  public async chatIdsAsync(transaction?: SqlTransaction): Promise<readonly string[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectWaitingChatIds, []))).map(t => t.readString(Resources.idColumn));
  }

  private read(rows: readonly DataRecord[]): readonly WaitingMessage[] {
    return rows.flatMap(t => {
      try {
        return [WaitingMessage.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson())];
      }
      catch (error) {
        const id = t.readString(Resources.idColumn);
        if (!this.skipped.has(id))
          this.log?.write(Resources.formatWaitingMessageSkipped(id, Resources.formatFailureKind(error)));
        this.skipped.add(id);
        return [];
      }
    });
  }
}
