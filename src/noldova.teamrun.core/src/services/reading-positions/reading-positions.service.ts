/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { SqlQuery } from "@noldova/context.data.sql";
import { ConversationPosition, type ReadingPositionSaveParams } from "@noldova/teamrun.protocol";

import type { IReadingPositionsService } from "../../interfaces/i-reading-positions.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class ReadingPositionsService implements IReadingPositionsService {
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public async listAsync(): Promise<readonly ConversationPosition[]> {
    return (await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectReadingPositions)))
      .map(t => ConversationPosition.fromJson(JsonReader.parse(t.readString(Resources.jsonColumn)).toJson()));
  }

  public async saveAsync(params: ReadingPositionSaveParams): Promise<void> {
    const updatedAt = new Date().toISOString();
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      for (const position of params.positions)
        await transaction.executeAsync(new SqlQuery(Resources.upsertReadingPosition,
          [position.conversationId, JSON.stringify(position.toJson()), updatedAt, position.conversationId]));
      for (const conversationId of params.cleared)
        await transaction.executeAsync(new SqlQuery(Resources.deleteReadingPosition, [conversationId]));
      for (const position of params.dropped)
        await transaction.executeAsync(new SqlQuery(Resources.deleteReadingPositionAt, [position.conversationId, position.messageId]));
    });
  }
}
