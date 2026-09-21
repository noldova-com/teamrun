/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isAbsolute, resolve } from "node:path";

import { Guid } from "@noldova/teamrun-foundation-core";
import { ChangeOperation, type DataRecord } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import {
  AuthStatus,
  ErrorCode,
  Event,
  EventName,
  ProviderAccount,
  type ProviderAccountCreateParams,
  type ProviderAccountIdParams
} from "@noldova/teamrun-protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IProviderAccountsService } from "../../interfaces/i-provider-accounts.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderRegistry } from "../providers/provider-registry.js";

export class ProviderAccountsService implements IProviderAccountsService {
  private readonly context: DatabaseContext;
  private readonly registry: ProviderRegistry;
  private readonly events: IEventSink;

  public constructor(context: DatabaseContext, registry: ProviderRegistry, events: IEventSink) {
    this.context = context;
    this.registry = registry;
    this.events = events;
  }

  public list(): readonly ProviderAccount[] {
    return this.context.database.connection.query(new SqlQuery(Resources.selectProviderAccounts)).map(t => ProviderAccountsService.read(t));
  }

  public find(providerAccountId: string): ProviderAccount | null {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectProviderAccountById, [providerAccountId]));
    if (Object.isUndefined(record))
      return null;

    return ProviderAccountsService.read(record);
  }

  public create(params: ProviderAccountCreateParams): ProviderAccount {
    if (!this.registry.has(params.provider))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotRegistered(params.provider), [params.provider]);
    if (!isAbsolute(params.profileDir))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProfileDirNotAbsolute(params.profileDir), [params.profileDir]);

    const now = new Date().toISOString();
    const id = Guid.createVersion7().toString();
    const account = new ProviderAccount(id, params.provider, params.label, resolve(params.profileDir), AuthStatus.Unknown, null, null, null, null, now);
    this.context.database.transaction(() => {
      const json = JSON.stringify(account.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.insertProviderAccount, [account.id, account.provider, json, now, now]));
      this.context.database.changeFeed.append(ChangeEntity.ProviderAccount, account.id, ChangeOperation.Insert, json);
    });
    return account;
  }

  public async check(params: ProviderAccountIdParams): Promise<ProviderAccount> {
    const account = this.require(params.providerAccountId);
    const check = await this.registry.get(account.provider).checkSignIn(account);
    const now = new Date().toISOString();
    const checked = account.withCheck(check.authStatus, check.identity, check.harnessVersion, now, check.error);
    this.context.database.transaction(() => {
      const json = JSON.stringify(checked.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateProviderAccount, [json, now, checked.id]));
      this.context.database.changeFeed.append(ChangeEntity.ProviderAccount, checked.id, ChangeOperation.Update, json);
    });
    this.events.publish(new Event(EventName.ProviderAccountUpdated, checked.toJson()));
    return checked;
  }

  public delete(params: ProviderAccountIdParams): void {
    this.context.database.transaction(() => {
      const account = this.require(params.providerAccountId);
      this.context.database.connection.execute(new SqlQuery(Resources.deleteProviderAccount, [account.id]));
      this.context.database.changeFeed.append(ChangeEntity.ProviderAccount, account.id, ChangeOperation.Delete, JSON.stringify(account.toJson()));
    });
  }

  private require(providerAccountId: string): ProviderAccount {
    const account = this.find(providerAccountId);
    if (Object.isNull(account))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderAccountNotFound(providerAccountId), [providerAccountId]);

    return account;
  }

  private static read(record: DataRecord): ProviderAccount {
    return ProviderAccount.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
