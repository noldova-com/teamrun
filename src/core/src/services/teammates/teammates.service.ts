/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Guid } from "@noldova/teamrun-foundation-core";
import { ChangeOperation, type DataRecord } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode, Teammate, type TeammateCreateParams, type TeammateUpdateParams, type TeammateIdParams, TeammateName } from "@noldova/teamrun-protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IProviderAccountsService } from "../../interfaces/i-provider-accounts.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class TeammatesService implements ITeammatesService {
  private readonly context: DatabaseContext;
  private readonly accounts: IProviderAccountsService;
  private readonly conversations: IConversationsService;

  public constructor(context: DatabaseContext, accounts: IProviderAccountsService, conversations: IConversationsService) {
    this.context = context;
    this.accounts = accounts;
    this.conversations = conversations;
  }

  public list(): readonly Teammate[] {
    return this.context.database.connection.query(new SqlQuery(Resources.selectTeammates)).map(t => TeammatesService.read(t));
  }

  public find(teammateId: string): Teammate | null {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectTeammateById, [teammateId]));
    return Object.isUndefined(record) ? null : TeammatesService.read(record);
  }

  public create(params: TeammateCreateParams): Teammate {
    return this.context.database.transaction(() => {
      this.requireAccount(params.providerAccountId);
      this.requireUniqueName(params.name, null);
      const now = new Date().toISOString();
      const teammate = new Teammate(Guid.createVersion7().toString(), params.name, params.role, params.providerAccountId,
        params.harness, params.model, params.effort, now, now);
      const json = JSON.stringify(teammate.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.insertTeammate,
        [teammate.id, TeammateName.key(teammate.name), json, now, now]));
      this.context.database.changeFeed.append(ChangeEntity.Teammate, teammate.id, ChangeOperation.Insert, json);
      return teammate;
    });
  }

  public update(params: TeammateUpdateParams): Teammate {
    return this.context.database.transaction(() => {
      const current = this.require(params.teammateId);
      this.requireUniqueName(params.name, current.id);
      if (params.providerAccountId !== current.providerAccountId) {
        this.requireAccount(params.providerAccountId);
        this.conversations.resetTeammateSessions(current.id);
      }
      const now = new Date().toISOString();
      const teammate = new Teammate(current.id, params.name, params.role, params.providerAccountId,
        params.harness, params.model, params.effort, current.createdAt, now);
      const json = JSON.stringify(teammate.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateTeammate, [TeammateName.key(teammate.name), json, now, teammate.id]));
      this.context.database.changeFeed.append(ChangeEntity.Teammate, teammate.id, ChangeOperation.Update, json);
      return teammate;
    });
  }

  public delete(params: TeammateIdParams): void {
    this.context.database.transaction(() => {
      const teammate = this.require(params.teammateId);
      this.conversations.removeTeammateMembers(teammate.id);
      this.context.database.connection.execute(new SqlQuery(Resources.deleteTeammate, [teammate.id]));
      this.context.database.changeFeed.append(ChangeEntity.Teammate, teammate.id, ChangeOperation.Delete, JSON.stringify(teammate.toJson()));
    });
  }

  private require(teammateId: string): Teammate {
    const teammate = this.find(teammateId);
    if (Object.isNull(teammate))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(teammateId), [teammateId]);
    return teammate;
  }

  private requireAccount(accountId: string): void {
    if (Object.isNull(this.accounts.find(accountId)))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderAccountNotFound(accountId), [accountId]);
  }

  private requireUniqueName(name: string, exceptId: string | null): void {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectTeammateByName, [TeammateName.key(name)]));
    if (!Object.isUndefined(record) && TeammatesService.read(record).id !== exceptId)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatTeammateNameTaken(name), [name]);
  }

  private static read(record: DataRecord): Teammate {
    return Teammate.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
