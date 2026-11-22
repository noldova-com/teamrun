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
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  type ComposerDefaultSaveParams, DefaultTeammate, DefaultTeammateSetParams, ErrorCode, NameOrder, type ProviderModelList, RequestedSettings, Teammate, type TeammateCreateParams,
  TeammateUpdateParams, type TeammateIdParams, TeammateName
} from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IOrganizationService } from "../../interfaces/i-organization.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class TeammatesService implements ITeammatesService {
  private readonly context: DatabaseContext;
  private readonly providers: IProvidersService;
  private readonly conversations: IConversationsService;
  private readonly organization: IOrganizationService;

  public constructor(context: DatabaseContext, providers: IProvidersService, conversations: IConversationsService, organization: IOrganizationService) {
    this.context = context;
    this.providers = providers;
    this.conversations = conversations;
    this.organization = organization;
  }

  public async listAsync(transaction?: SqlTransaction): Promise<readonly Teammate[]> {
    const records = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectTeammates));
    return NameOrder.sort(records.map(t => TeammatesService.read(t)), t => t.name);
  }

  public async findAsync(teammateId: string, transaction?: SqlTransaction): Promise<Teammate | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectTeammateById, [teammateId]));
    return Object.isUndefined(record) ? null : TeammatesService.read(record);
  }

  public async createAsync(params: TeammateCreateParams): Promise<Teammate> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.requireProviderAsync(params.providerId, transaction);
      await this.requireUniqueNameAsync(params.name, null, transaction);
      await this.requireTeammatesAsync(params.usageHandOffs, transaction);
      const now = new Date().toISOString();
      const teammate = new Teammate(Guid.createVersion7().toString(), params.name, params.role, params.providerId,
        params.harness, params.model, params.effort, now, now, params.speed, params.mode, params.contextWindow, params.usageHandOffs, params.sustain,
        params.fallbacks, params.resetsSoonestFirst);
      const json = JSON.stringify(teammate.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertTeammate,
        [teammate.id, TeammateName.key(teammate.name), json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Teammate, teammate.id, ChangeOperation.Insert, json, transaction);
      return teammate;
    });
  }

  public async updateAsync(params: TeammateUpdateParams, checked: Teammate | null = null): Promise<Teammate> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireAsync(params.teammateId, transaction);
      if (!Object.isUndefined(params.expectedProviderId) && params.expectedProviderId !== current.providerId)
        throw new ServiceException(ErrorCode.Conflict, Resources.formatTeammateProviderChanged(current.name), [current.id]);
      if (!Object.isNull(checked) && TeammatesService.boundOf(checked) !== TeammatesService.boundOf(current))
        throw new ServiceException(ErrorCode.Conflict, Resources.formatTeammateChangedWhileChecked(current.name), [current.id]);
      const name = params.name ?? current.name;
      const providerId = params.providerId ?? current.providerId;
      await this.requireUniqueNameAsync(name, current.id, transaction);
      await this.requireTeammatesAsync(params.usageHandOffs ?? [], transaction);
      if (providerId !== current.providerId) {
        await this.requireProviderAsync(providerId, transaction);
        await this.conversations.resetTeammateSessionsAsync(current.id, transaction);
      }
      return await this.saveAsync(params.applyTo(current, new Date().toISOString()), transaction);
    });
  }

  public async clearUnlistedAsync(providerId: string, list: ProviderModelList): Promise<readonly Teammate[]> {
    const speedOf = (model: string | null, speed: string | null): string | null =>
      list.models.find(t => t.matches(model))?.speeds.some(t => t.id === speed) === true ? speed : null;
    const modeOf = (mode: string | null): string | null => list.modes.length === 0 || list.modes.some(t => t.id === mode) ? mode : null;
    const unlisted = (model: string | null, speed: string | null, mode: string | null): boolean => speedOf(model, speed) !== speed || modeOf(mode) !== mode;
    const windowOf = (model: string | null, window: number | null): number | null =>
      Object.isNull(window) || list.models.find(t => t.matches(model))?.contextWindows?.allows(window) === true ? window : null;
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const chosen = await this.readDefaultAsync(transaction);
      if (!Object.isNull(chosen) && chosen.providerId === providerId && unlisted(chosen.requested.model, chosen.requested.speed, chosen.requested.mode)) {
        const requested = chosen.requested;
        await this.setDefaultAsync(new DefaultTeammateSetParams(new DefaultTeammate(new RequestedSettings(requested.kind, requested.model, requested.effort,
          speedOf(requested.model, requested.speed), modeOf(requested.mode)), providerId)), transaction);
      }
      const cleared: Teammate[] = [];
      for (const u of (await this.listAsync(transaction)).filter(t => t.providerId === providerId
        && (unlisted(t.model, t.speed, t.mode) || windowOf(t.model, t.contextWindow) !== t.contextWindow)))
        cleared.push(await this.saveAsync(new Teammate(u.id, u.name, u.role, u.providerId, u.harness, u.model, u.effort, u.createdAt, new Date().toISOString(),
          speedOf(u.model, u.speed), modeOf(u.mode), windowOf(u.model, u.contextWindow), u.usageHandOffs, u.sustain, u.fallbacks, u.resetsSoonestFirst), transaction));
      return cleared;
    });
  }

  private async saveAsync(teammate: Teammate, transaction: SqlTransaction): Promise<Teammate> {
    const json = JSON.stringify(teammate.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateTeammate, [TeammateName.key(teammate.name), json, teammate.updatedAt, teammate.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Teammate, teammate.id, ChangeOperation.Update, json, transaction);
    return teammate;
  }

  public async deleteAsync(params: TeammateIdParams): Promise<readonly string[]> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const teammate = await this.requireAsync(params.teammateId, transaction);
      await this.conversations.removeTeammateMembersAsync(teammate.id, transaction);
      const departed = await this.organization.removeTeammateAsync(teammate.id, transaction);
      await transaction.executeAsync(new SqlQuery(Resources.deleteTeammate, [teammate.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Teammate, teammate.id, ChangeOperation.Delete, JSON.stringify(teammate.toJson()), transaction);
      const updatedAt = new Date().toISOString();
      for (const other of (await this.listAsync(transaction)).filter(t => t.usageHandOffs.includes(teammate.id)))
        await this.saveAsync(TeammateUpdateParams.of(other.id, { usageHandOffs: other.usageHandOffs.filter(t => t !== teammate.id) }).applyTo(other, updatedAt), transaction);
      return departed;
    });
  }

  public async readDefaultAsync(transaction?: SqlTransaction): Promise<DefaultTeammate | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectPreference, [Resources.defaultTeammatePreference]));
    return Object.isUndefined(record) ? null : DefaultTeammate.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }

  public async setDefaultAsync(params: DefaultTeammateSetParams, transaction?: SqlTransaction): Promise<DefaultTeammate | null> {
    if (Object.isUndefined(transaction))
      return await this.context.database.connection.runInTransactionAsync(t => this.setDefaultAsync(params, t));

    const chosen = params.defaultTeammate;
    if (!Object.isNull(chosen) && !Object.isNull(chosen.providerId)) {
      const providerId = chosen.providerId;
      const provider = await this.providers.findAsync(providerId, transaction);
      if (Object.isNull(provider))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotFound(providerId), [providerId]);
      if (provider.kind !== chosen.requested.kind)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProviderMismatch(providerId, chosen.requested.kind),
          [providerId, chosen.requested.kind]);
    }
    const previous = await this.readDefaultAsync(transaction);
    if (Object.isNull(chosen)) {
      if (Object.isNull(previous))
        return null;
      await transaction.executeAsync(new SqlQuery(Resources.deletePreference, [Resources.defaultTeammatePreference]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, Resources.defaultTeammatePreference, ChangeOperation.Delete,
        JSON.stringify(previous.toJson()), transaction);
      return null;
    }
    const json = JSON.stringify(chosen.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.upsertPreference, [Resources.defaultTeammatePreference, json, new Date().toISOString()]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, Resources.defaultTeammatePreference,
      Object.isNull(previous) ? ChangeOperation.Insert : ChangeOperation.Update, json, transaction);
    return chosen;
  }

  public async moveProviderlessDefaultAsync(providerOf: (kind: string, transaction: SqlTransaction) => Promise<string | null>): Promise<DefaultTeammate | null> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const chosen = await this.readDefaultAsync(transaction);
      if (Object.isNull(chosen) || !Object.isNull(chosen.providerId))
        return null;
      const providerId = await providerOf(chosen.requested.kind, transaction);
      return Object.isNull(providerId) ? null : await this.setDefaultAsync(new DefaultTeammateSetParams(new DefaultTeammate(chosen.requested, providerId)), transaction);
    });
  }

  public async readComposerDefaultAsync(transaction?: SqlTransaction): Promise<JsonObject | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectPreference, [Resources.composerDefaultPreference]));
    return Object.isUndefined(record) ? null : JsonReader.parse(record.readString(Resources.jsonColumn)).toJson();
  }

  public async saveComposerDefaultAsync(params: ComposerDefaultSaveParams): Promise<JsonObject> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const previous = await this.readComposerDefaultAsync(transaction);
      if (params.onlyIfNone && !Object.isNull(previous))
        return previous;
      const json = JSON.stringify(params.choice);
      await transaction.executeAsync(new SqlQuery(Resources.upsertPreference, [Resources.composerDefaultPreference, json, new Date().toISOString()]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, Resources.composerDefaultPreference,
        Object.isNull(previous) ? ChangeOperation.Insert : ChangeOperation.Update, json, transaction);
      return params.choice;
    });
  }

  private async requireAsync(teammateId: string, transaction: SqlTransaction): Promise<Teammate> {
    const teammate = await this.findAsync(teammateId, transaction);
    if (Object.isNull(teammate))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(teammateId), [teammateId]);
    return teammate;
  }

  private async requireProviderAsync(providerId: string, transaction: SqlTransaction): Promise<void> {
    if (Object.isNull(await this.providers.findAsync(providerId, transaction)))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotFound(providerId), [providerId]);
  }

  private async requireTeammatesAsync(teammateIds: readonly string[], transaction: SqlTransaction): Promise<void> {
    for (const teammateId of teammateIds)
      await this.requireAsync(teammateId, transaction);
  }

  private async requireUniqueNameAsync(name: string, exceptId: string | null, transaction: SqlTransaction): Promise<void> {
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectTeammateByName, [TeammateName.key(name)]));
    if (!Object.isUndefined(record) && TeammatesService.read(record).id !== exceptId)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatTeammateNameTaken(name), [name]);
  }

  private static boundOf(teammate: Teammate): string {
    return JSON.stringify([teammate.providerId, teammate.model, teammate.contextWindow]);
  }

  private static read(record: DataRecord): Teammate {
    return Teammate.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
