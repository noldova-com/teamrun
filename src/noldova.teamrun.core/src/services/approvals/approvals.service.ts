/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { Approval, type ConversationIdParams } from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class ApprovalsService implements IApprovalsService {
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public async listAsync(params: ConversationIdParams): Promise<readonly Approval[]> {
    return this.queryAsync(Resources.selectListedApprovalsByConversation, params.conversationId);
  }

  public async listPendingAllAsync(transaction?: SqlTransaction): Promise<readonly Approval[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectAllPendingApprovals))).map(t => ApprovalsService.read(t));
  }

  public async listUnsentAnswersAsync(transaction?: SqlTransaction): Promise<readonly Approval[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectUnsentAnswers))).map(t => ApprovalsService.read(t));
  }

  public async findAsync(approvalId: string, transaction?: SqlTransaction): Promise<Approval | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectApprovalById, [approvalId]));
    if (Object.isUndefined(record))
      return null;

    return ApprovalsService.read(record);
  }

  public async listPendingAsync(messageId: string, transaction?: SqlTransaction): Promise<readonly Approval[]> {
    return this.queryAsync(Resources.selectPendingApprovalsByMessage, messageId, transaction);
  }

  public async insertAsync(approval: Approval, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction)) {
      await this.context.database.connection.runInTransactionAsync(t => this.insertAsync(approval, t));
      return;
    }
    const json = JSON.stringify(approval.toJson());
    const parameters = [approval.id, approval.messageId, approval.status, json, approval.createdAt, approval.createdAt];
    await transaction.executeAsync(new SqlQuery(Resources.insertApproval, parameters));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Approval, approval.id, ChangeOperation.Insert, json, transaction);
  }

  public async updateAsync(approval: Approval, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction)) {
      await this.context.database.connection.runInTransactionAsync(t => this.updateAsync(approval, t));
      return;
    }
    const json = JSON.stringify(approval.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateApproval, [approval.status, json, new Date().toISOString(), approval.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Approval, approval.id, ChangeOperation.Update, json, transaction);
  }

  private async queryAsync(statement: string, parameter: string, transaction?: SqlTransaction): Promise<readonly Approval[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(statement, [parameter]))).map(t => ApprovalsService.read(t));
  }

  private static read(record: DataRecord): Approval {
    return Approval.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
