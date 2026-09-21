/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ChangeOperation, type DataRecord } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Approval, type ConversationIdParams } from "@noldova/teamrun-protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class ApprovalsService implements IApprovalsService {
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public list(params: ConversationIdParams): readonly Approval[] {
    return this.query(Resources.selectPendingApprovalsByConversation, params.conversationId);
  }

  public listPendingAll(): readonly Approval[] {
    return this.context.database.connection.query(new SqlQuery(Resources.selectAllPendingApprovals)).map(t => ApprovalsService.read(t));
  }

  public find(approvalId: string): Approval | null {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectApprovalById, [approvalId]));
    if (Object.isUndefined(record))
      return null;

    return ApprovalsService.read(record);
  }

  public listPending(messageId: string): readonly Approval[] {
    return this.query(Resources.selectPendingApprovalsByMessage, messageId);
  }

  public insert(approval: Approval): void {
    this.context.database.transaction(() => {
      const json = JSON.stringify(approval.toJson());
      const parameters = [approval.id, approval.messageId, approval.status, json, approval.createdAt, approval.createdAt];
      this.context.database.connection.execute(new SqlQuery(Resources.insertApproval, parameters));
      this.context.database.changeFeed.append(ChangeEntity.Approval, approval.id, ChangeOperation.Insert, json);
    });
  }

  public update(approval: Approval): void {
    this.context.database.transaction(() => {
      const json = JSON.stringify(approval.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateApproval, [approval.status, json, new Date().toISOString(), approval.id]));
      this.context.database.changeFeed.append(ChangeEntity.Approval, approval.id, ChangeOperation.Update, json);
    });
  }

  private query(statement: string, parameter: string): readonly Approval[] {
    return this.context.database.connection.query(new SqlQuery(statement, [parameter])).map(t => ApprovalsService.read(t));
  }

  private static read(record: DataRecord): Approval {
    return Approval.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
