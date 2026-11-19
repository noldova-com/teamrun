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
import { ServiceException } from "@noldova/teamrun.services";
import {
  ErrorCode, Event, EventName, type Provider, type SharedMcpAccount, type SharedMcpProviderSetParams, SharedMcpSecret, type SharedMcpSecretSetParams, SharedMcpServer,
  SharedMcpServerDefinition, type SharedMcpServerIdParams, SharedMcpServerListing, type SharedMcpServerUpdateParams, SharedMcpSetting,
  SharedMcpSignIn, SharedMcpSignInStarted,
  type SharedMcpTeammateSetParams, SharedMcpTeammateSetting, SharedMcpUnavailability, SharedMcpVariable, SharedMcpVariableSource
} from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { ISharedMcpAccounts } from "../../interfaces/i-shared-mcp-accounts.js";
import type { ISharedMcpSecrets } from "../../interfaces/i-shared-mcp-secrets.js";
import type { ISharedMcpServersService } from "../../interfaces/i-shared-mcp-servers.service.js";
import type { ISharedMcpSignIn } from "../../interfaces/i-shared-mcp-sign-in.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { Guid } from "../../models/guid.js";
import type { SharedMcpAccess } from "../../models/shared-mcp-access.js";
import { SharedMcpRefusal } from "../../models/shared-mcp-refusal.js";
import { SharedMcpSelection } from "../../models/shared-mcp-selection.js";
import { SharedMcpValues } from "../../models/shared-mcp-values.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";

export class SharedMcpServersService implements ISharedMcpServersService {
  private readonly context: DatabaseContext;
  private readonly providers: IProvidersService;
  private readonly teammates: ITeammatesService;
  private readonly registry: ProviderKindRegistry;
  private readonly readEnvironment: () => Promise<Readonly<Record<string, string | undefined>>>;
  private readonly secrets: ISharedMcpSecrets;
  private readonly signIns: ISharedMcpSignIn;
  private readonly accounts: ISharedMcpAccounts;
  private readonly events: IEventSink | null;
  private readonly log: ILog | null;
  private readonly signingIn: Map<string, { reference: string; starts: number; ended: boolean }> = new Map();

  public constructor(context: DatabaseContext, providers: IProvidersService, teammates: ITeammatesService, registry: ProviderKindRegistry,
    readEnvironment: () => Promise<Readonly<Record<string, string | undefined>>>, secrets: ISharedMcpSecrets, signIns: ISharedMcpSignIn,
    accounts: ISharedMcpAccounts, events: IEventSink | null, log: ILog | null = null) {
    this.context = context;
    this.providers = providers;
    this.teammates = teammates;
    this.registry = registry;
    this.readEnvironment = readEnvironment;
    this.secrets = secrets;
    this.signIns = signIns;
    this.accounts = accounts;
    this.events = events;
    this.log = log;
  }

  public async listAsync(): Promise<readonly SharedMcpServerListing[]> {
    const environment = await this.readEnvironment();
    const providers = await this.providers.listAsync();
    const listings: SharedMcpServerListing[] = [];
    for (const stored of await this.readAllAsync()) {
      const server = await this.keptAsync(stored, stored.definition, stored.updatedAt);
      const checked = await this.checkAsync(server, environment);
      listings.push(new SharedMcpServerListing(server, providers
        .map(provider => [provider.id, this.unavailable(server, provider, null) ?? checked.refusal] as const)
        .filter((t): t is readonly [string, SharedMcpRefusal] => !Object.isNull(t[1]))
        .map(([providerId, refusal]) => new SharedMcpUnavailability(providerId, refusal.reason, refusal.short)), checked.variables,
      this.signingIn.has(server.id)));
    }
    return listings;
  }

  public async createAsync(definition: SharedMcpServerDefinition): Promise<SharedMcpServer> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.requireUniqueNameAsync(definition.name, null, transaction);
      const now = new Date().toISOString();
      const server = new SharedMcpServer(Guid.createVersion7().toString(), definition, [], [], now, now);
      const json = JSON.stringify(server.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertSharedMcpServer, [server.id, server.definition.name, json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.SharedMcpServer, server.id, ChangeOperation.Insert, json, transaction);
      return server;
    });
  }

  public async updateAsync(params: SharedMcpServerUpdateParams): Promise<SharedMcpServer> {
    const [current, updated] = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireAsync(params.serverId, transaction);
      await this.requireUniqueNameAsync(params.definition.name, current.id, transaction);
      return [current, await this.saveAsync(await this.keptAsync(current, params.definition, new Date().toISOString(), transaction), transaction)] as const;
    });
    this.forget(current.secrets.filter(t => Object.isNull(updated.referenceOf(t.variable))));
    if (updated.signIn?.reference !== current.signIn?.reference)
      this.signOut(current);
    return updated;
  }

  public async deleteAsync(params: SharedMcpServerIdParams): Promise<void> {
    const server = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const server = await this.requireAsync(params.serverId, transaction);
      await transaction.executeAsync(new SqlQuery(Resources.deleteSharedMcpServer, [server.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.SharedMcpServer, server.id, ChangeOperation.Delete, JSON.stringify(server.toJson()), transaction);
      return server;
    });
    this.forget(server.secrets);
    this.signOut(server);
  }

  public async setProviderAsync(params: SharedMcpProviderSetParams): Promise<SharedMcpServer> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireAsync(params.serverId, transaction);
      if (Object.isNull(await this.providers.findAsync(params.providerId, transaction)))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotFound(params.providerId), [params.providerId]);
      const kept = await this.keptAsync(current, current.definition, new Date().toISOString(), transaction);
      const others = kept.providerIds.filter(t => t !== params.providerId);
      const providerIds = params.on ? [...others, params.providerId] : others;
      return await this.saveAsync(new SharedMcpServer(kept.id, kept.definition, providerIds, kept.teammates, kept.createdAt, kept.updatedAt, kept.secrets, kept.signIn),
        transaction);
    });
  }

  public async setTeammateAsync(params: SharedMcpTeammateSetParams): Promise<SharedMcpServer> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireAsync(params.serverId, transaction);
      if (Object.isNull(await this.teammates.findAsync(params.teammateId, transaction)))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(params.teammateId), [params.teammateId]);
      const kept = await this.keptAsync(current, current.definition, new Date().toISOString(), transaction);
      const others = kept.teammates.filter(t => t.teammateId !== params.teammateId);
      const teammates = params.setting === SharedMcpSetting.AsProvider ? others : [...others, new SharedMcpTeammateSetting(params.teammateId, params.setting)];
      return await this.saveAsync(new SharedMcpServer(kept.id, kept.definition, kept.providerIds, teammates, kept.createdAt, kept.updatedAt, kept.secrets, kept.signIn),
        transaction);
    });
  }

  public async setSecretAsync(params: SharedMcpSecretSetParams): Promise<SharedMcpServer> {
    const [previous, saved] = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const server = await this.requireAsync(params.serverId, transaction);
      this.requireNamed(server, params.variable);
      if (!Object.isNull(params.reference))
        await this.requireUnkeptAsync(params.reference, server.id, params.variable, transaction);
      const kept = await this.keptAsync(server, server.definition, new Date().toISOString(), transaction);
      const others = kept.secrets.filter(t => t.variable !== params.variable);
      const secrets = Object.isNull(params.reference) ? others : [...others, new SharedMcpSecret(params.variable, params.reference, kept.updatedAt)];
      return [server.secrets.filter(t => t.variable === params.variable && t.reference !== params.reference),
        await this.saveAsync(new SharedMcpServer(kept.id, kept.definition, kept.providerIds, kept.teammates, kept.createdAt, kept.updatedAt, secrets,
          kept.signIn), transaction)] as const;
    });
    this.forget(previous);
    return saved;
  }

  public async startSignInAsync(params: SharedMcpServerIdParams): Promise<SharedMcpSignInStarted> {
    const server = await this.requireAsync(params.serverId);
    const url = server.definition.url;
    if (!server.definition.signsIn || Object.isNull(url))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSharedMcpServerDoesntSignIn(server.definition.name), [server.id]);
    const pending = this.signingIn.get(server.id) ?? { reference: server.signIn?.reference
      ?? `${Resources.sharedMcpSignInReferencePrefix}${Guid.newGuid().toString().replaceAll(Resources.guidGroupSeparator, String.empty)}`, starts: 0, ended: false };
    const reference = pending.reference;
    pending.starts += 1;
    this.signingIn.set(server.id, pending);
    let address: string | null;
    try {
      address = await this.signIns.startAsync(url, reference, access => void this.finishAsync(server, url, pending, access));
    }
    catch (error) {
      pending.starts -= 1;
      if (pending.starts === 0 && this.signingIn.get(server.id) === pending)
        this.signingIn.delete(server.id);
      throw error;
    }
    this.events?.publish(new Event(EventName.StateInvalidated, null));
    return new SharedMcpSignInStarted(address);
  }

  public async signOutOfAsync(params: SharedMcpServerIdParams): Promise<SharedMcpServer> {
    const [server, saved] = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const server = await this.requireAsync(params.serverId, transaction);
      const kept = await this.keptAsync(server, server.definition, new Date().toISOString(), transaction);
      const signedOut = new SharedMcpServer(kept.id, kept.definition, kept.providerIds, kept.teammates, kept.createdAt, kept.updatedAt, kept.secrets);
      return [server, await this.saveAsync(signedOut, transaction)] as const;
    });
    this.signOut(server);
    return saved;
  }

  public async selectAsync(provider: Provider | null, teammateId: string | null, workingDirectory: string | null): Promise<SharedMcpSelection> {
    if (Object.isNull(provider))
      return SharedMcpSelection.none;

    const environment = await this.readEnvironment();
    const servers: SharedMcpServerDefinition[] = [];
    const notes: string[] = [];
    const values = new Map<string, ReadonlyMap<string, string>>();
    const taken = new Map<string, string>();
    for (const server of (await this.readAllAsync()).filter(t => t.reaches(provider.id, teammateId))) {
      const unavailable = this.unavailable(server, provider, workingDirectory) ?? this.clashOf(server, provider, taken);
      const read = Object.isNull(unavailable) ? await this.readAsync(server, environment) : null;
      const reason = unavailable?.reason ?? read?.reason ?? null;
      if (Object.isNull(reason) && !Object.isNull(read)) {
        servers.push(read.definition);
        values.set(server.definition.name, read.values);
        taken.set(this.namespaceOf(server, provider), server.definition.name);
      }
      else if (!Object.isNull(reason))
        notes.push(Resources.formatSharedMcpServerLeftOut(server.definition.name, reason));
    }
    return new SharedMcpSelection(servers, notes, new SharedMcpValues(values));
  }

  private namespaceOf(server: SharedMcpServer, provider: Provider): string {
    return this.registry.get(provider.kind).sharedServerNamespaceOf?.(server.definition.name) ?? server.definition.name;
  }

  private clashOf(server: SharedMcpServer, provider: Provider, taken: ReadonlyMap<string, string>): SharedMcpRefusal | null {
    const other = taken.get(this.namespaceOf(server, provider));
    return Object.isUndefined(other)
      ? null
      : new SharedMcpRefusal(Resources.formatSharedMcpNameClash(this.registry.get(provider.kind).descriptor.displayName, other), Resources.sharedMcpNameClashShort);
  }

  private unavailable(server: SharedMcpServer, provider: Provider, workingDirectory: string | null): SharedMcpRefusal | null {
    if (!this.registry.has(provider.kind))
      return new SharedMcpRefusal(Resources.formatSharedMcpServersUnsupported(provider.kind), Resources.sharedMcpServersUnsupportedShort);
    const adapter = this.registry.get(provider.kind);
    if (Object.isUndefined(adapter.sharedServerUnavailable))
      return new SharedMcpRefusal(Resources.formatSharedMcpServersUnsupported(adapter.descriptor.displayName), Resources.sharedMcpServersUnsupportedShort);
    const refused = adapter.sharedServerUnavailable(server.definition, provider, workingDirectory);
    if (!Object.isNull(refused) || server.secrets.length === 0 && !server.definition.signsIn && Object.isNull(server.definition.account))
      return refused;
    const refusal = Object.isUndefined(adapter.savedSecretsUnavailable)
      ? new SharedMcpRefusal(Resources.formatSharedMcpSecretsUnsupported(adapter.descriptor.displayName), Resources.sharedMcpSecretsUnsupportedShort)
      : adapter.savedSecretsUnavailable(server.definition);
    return Object.isNull(refusal) || !server.definition.signsIn
      ? refusal
      : new SharedMcpRefusal(Resources.formatSharedMcpSignInUnsupported(adapter.descriptor.displayName), Resources.sharedMcpSignInUnsupportedShort);
  }

  private async checkAsync(server: SharedMcpServer, environment: Readonly<Record<string, string | undefined>>)
    : Promise<{ variables: readonly SharedMcpVariable[]; refusal: SharedMcpRefusal | null }> {
    const variables: SharedMcpVariable[] = [];
    let refusal: SharedMcpRefusal | null = null;
    for (const variable of new Set(server.definition.referencedVariables)) {
      const reference = server.referenceOf(variable);
      const missing = Object.isNull(reference)
        ? Object.isUndefined(environment[variable])
          ? new SharedMcpRefusal(Resources.formatSharedMcpVariableUnset(variable), Resources.formatSharedMcpVariableUnsetShort(variable))
          : null
        : await this.checkSecretAsync(variable, reference);
      variables.push(new SharedMcpVariable(variable, Object.isNull(reference) ? SharedMcpVariableSource.Environment : SharedMcpVariableSource.Saved,
        Object.isNull(missing), server.secrets.find(t => t.variable === variable)?.updatedAt ?? null));
      refusal ??= missing;
    }
    const account = server.definition.account;
    return { variables, refusal: refusal ?? SharedMcpServersService.signInRefusal(server)
      ?? (Object.isNull(account) ? null : (await this.accountAsync(account)).refusal) };
  }

  private async checkSecretAsync(variable: string, reference: string): Promise<SharedMcpRefusal | null> {
    try {
      return await this.secrets.isSetAsync(reference)
        ? null
        : new SharedMcpRefusal(Resources.formatSharedMcpSecretMissing(variable), Resources.formatSharedMcpSecretMissingShort(variable));
    }
    catch (error) {
      return new SharedMcpRefusal(Resources.formatSharedMcpSecretUnreadable(variable, SharedMcpServersService.describe(error)),
        Resources.formatSharedMcpSecretUnreadableShort(variable));
    }
  }

  private async readAsync(server: SharedMcpServer, environment: Readonly<Record<string, string | undefined>>)
    : Promise<{ definition: SharedMcpServerDefinition; values: ReadonlyMap<string, string>; reason: string | null }> {
    const values = new Map<string, string>();
    const definition = server.definition;
    for (const variable of new Set(server.definition.referencedVariables)) {
      const reference = server.referenceOf(variable);
      if (Object.isNull(reference)) {
        if (Object.isUndefined(environment[variable]))
          return { definition, values: new Map(), reason: Resources.formatSharedMcpVariableUnset(variable) };
        continue;
      }
      let value: string | null;
      try {
        value = await this.secrets.readAsync(reference);
      }
      catch (error) {
        return { definition, values: new Map(), reason: Resources.formatSharedMcpSecretUnreadable(variable, SharedMcpServersService.describe(error)) };
      }
      if (Object.isNull(value))
        return { definition, values: new Map(), reason: Resources.formatSharedMcpSecretMissing(variable) };
      values.set(variable, value);
    }
    if (!Object.isNull(definition.account)) {
      const access = await this.accountAsync(definition.account);
      if (!Object.isNull(access.refusal))
        return { definition, values: new Map(), reason: access.refusal.reason };
      values.set(Resources.sharedMcpAccessVariable, access.token);
      return { definition: SharedMcpServersService.withBearer(definition), values, reason: null };
    }
    if (!definition.signsIn)
      return { definition, values, reason: null };
    const access = await this.accessAsync(server);
    if (!Object.isNull(access.reason))
      return { definition, values: new Map(), reason: access.reason };
    values.set(Resources.sharedMcpAccessVariable, access.token);
    return { definition: SharedMcpServersService.withBearer(definition), values, reason: null };
  }

  private async accountAsync(account: SharedMcpAccount): Promise<{ token: string; refusal: SharedMcpRefusal | null }> {
    let access: SharedMcpAccess;
    try {
      access = await this.accounts.accessAsync(account);
    }
    catch (error) {
      return { token: String.empty, refusal: new SharedMcpRefusal(Resources.formatSharedMcpAccountUnreadable(account, SharedMcpServersService.describe(error)),
        Resources.sharedMcpSignInNeededShort) };
    }
    return Object.isNull(access.needsSignIn)
      ? { token: access.token, refusal: null }
      : { token: String.empty, refusal: new SharedMcpRefusal(access.needsSignIn, Resources.sharedMcpSignInNeededShort) };
  }

  private async accessAsync(server: SharedMcpServer): Promise<{ token: string; reason: string | null }> {
    const url = server.definition.url;
    if (Object.isNull(server.signIn) || Object.isNull(url))
      return { token: String.empty, reason: Resources.sharedMcpSignInNeeded };
    let access: SharedMcpAccess;
    try {
      access = await this.signIns.accessAsync(url, server.signIn.reference);
    }
    catch (error) {
      return { token: String.empty, reason: Resources.formatSharedMcpSignInUnreadable(SharedMcpServersService.describe(error)) };
    }
    await this.recordAsync(server.id, server.signIn.reference, access);
    return { token: access.token, reason: Object.isNull(access.needsSignIn) ? null : Resources.formatSharedMcpSignInExpired(access.needsSignIn) };
  }

  private async recordAsync(serverId: string, reference: string, access: SharedMcpAccess): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const server = await this.findAsync(serverId, transaction);
      if (Object.isNull(server) || Object.isNull(server.signIn) || server.signIn.reference !== reference
        || server.signIn.expiresAt === access.expiresAt && server.signIn.needsSignIn === access.needsSignIn)
        return;
      await this.saveAsync(SharedMcpServersService.signedIn(server, reference, access), transaction);
    });
  }

  private async finishAsync(started: SharedMcpServer, url: string, pending: { reference: string; ended: boolean }, access: SharedMcpAccess): Promise<void> {
    const reference = pending.reference;
    if (pending.ended) {
      this.signOut(SharedMcpServersService.signedIn(started, reference, access), pending);
      this.events?.publish(new Event(EventName.StateInvalidated, null));
      return;
    }
    if (this.signingIn.get(started.id) === pending)
      this.signingIn.delete(started.id);
    try {
      const kept = await this.context.database.connection.runInTransactionAsync(async transaction => {
        const server = await this.findAsync(started.id, transaction);
        if (Object.isNull(server) || !server.definition.signsIn || server.definition.url !== url)
          return false;
        if (Object.isNull(access.needsSignIn) || Object.isNull(server.signIn) || !Object.isNull(server.signIn.needsSignIn))
          await this.saveAsync(SharedMcpServersService.signedIn(server, reference, access), transaction);
        return true;
      });
      if (!kept)
        this.signOut(SharedMcpServersService.signedIn(started, reference, access), pending);
    }
    catch (error) {
      this.log?.write(Resources.formatSharedMcpSignInUnsaved(started.definition.name, SharedMcpServersService.describe(error)));
    }
    this.events?.publish(new Event(EventName.StateInvalidated, null));
  }

  private signOut(server: SharedMcpServer, pending: { reference: string; ended: boolean } | undefined = this.signingIn.get(server.id)): void {
    if (!Object.isUndefined(pending)) {
      pending.ended = true;
      if (this.signingIn.get(server.id) === pending)
        this.signingIn.delete(server.id);
    }
    const reference = server.signIn?.reference ?? pending?.reference;
    if (Object.isUndefined(reference))
      return;
    void this.signIns.signOutAsync(reference)
      .catch((error: unknown) => this.log?.write(Resources.formatSharedMcpSignInKept(server.definition.name, SharedMcpServersService.describe(error))));
  }

  private forget(secrets: readonly SharedMcpSecret[]): void {
    for (const secret of secrets)
      void this.secrets.removeAsync(secret.reference)
        .catch((error: unknown) => this.log?.write(Resources.formatSharedMcpSecretKept(secret.variable, SharedMcpServersService.describe(error))));
  }

  private async keptAsync(server: SharedMcpServer, definition: SharedMcpServerDefinition, updatedAt: string, transaction?: SqlTransaction): Promise<SharedMcpServer> {
    const providerIds = new Set((await this.providers.listAsync(transaction)).map(t => t.id));
    const teammateIds = new Set((await this.teammates.listAsync(transaction)).map(t => t.id));
    return new SharedMcpServer(server.id, definition, server.providerIds.filter(t => providerIds.has(t)),
      server.teammates.filter(t => teammateIds.has(t.teammateId)), server.createdAt, updatedAt,
      server.secrets.filter(t => definition.referencedVariables.includes(t.variable)),
      definition.signsIn && definition.url === server.definition.url ? server.signIn : null);
  }

  private async saveAsync(server: SharedMcpServer, transaction: SqlTransaction): Promise<SharedMcpServer> {
    const json = JSON.stringify(server.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateSharedMcpServer, [server.definition.name, json, server.updatedAt, server.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.SharedMcpServer, server.id, ChangeOperation.Update, json, transaction);
    return server;
  }

  private async readAllAsync(transaction?: SqlTransaction): Promise<readonly SharedMcpServer[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectSharedMcpServers))).map(t => SharedMcpServersService.read(t));
  }

  private async findAsync(serverId: string, transaction: SqlTransaction): Promise<SharedMcpServer | null> {
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectSharedMcpServerById, [serverId]));
    return Object.isUndefined(record) ? null : SharedMcpServersService.read(record);
  }

  private async requireAsync(serverId: string, transaction?: SqlTransaction): Promise<SharedMcpServer> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectSharedMcpServerById, [serverId]));
    if (Object.isUndefined(record))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatSharedMcpServerNotFound(serverId), [serverId]);
    return SharedMcpServersService.read(record);
  }

  private requireNamed(server: SharedMcpServer, variable: string): void {
    if (!server.definition.referencedVariables.includes(variable))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatSharedMcpVariableNotNamed(server.definition.name, variable), [variable]);
  }

  private async requireUnkeptAsync(reference: string, serverId: string, variable: string, transaction: SqlTransaction): Promise<void> {
    if ((await this.readAllAsync(transaction)).some(t => t.secrets.some(u => u.reference === reference && (t.id !== serverId || u.variable !== variable))))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatSharedMcpSecretTaken(variable), [variable]);
  }

  private async requireUniqueNameAsync(name: string, exceptId: string | null, transaction: SqlTransaction): Promise<void> {
    if (name.startsWith(Resources.sharedMcpServerReservedPrefix))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.sharedMcpServerNameReserved, [name]);
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectSharedMcpServerByName, [name]));
    if (!Object.isUndefined(record) && SharedMcpServersService.read(record).id !== exceptId)
      throw new ServiceException(ErrorCode.Conflict, Resources.formatSharedMcpServerNameTaken(name), [name]);
  }

  private static signedIn(server: SharedMcpServer, reference: string, access: SharedMcpAccess): SharedMcpServer {
    return new SharedMcpServer(server.id, server.definition, server.providerIds, server.teammates, server.createdAt, server.updatedAt, server.secrets,
      new SharedMcpSignIn(reference, access.expiresAt, access.needsSignIn, new Date().toISOString()));
  }

  private static signInRefusal(server: SharedMcpServer): SharedMcpRefusal | null {
    if (!server.definition.signsIn)
      return null;
    if (Object.isNull(server.signIn))
      return new SharedMcpRefusal(Resources.sharedMcpSignInNeeded, Resources.sharedMcpSignInNeededShort);
    return Object.isNull(server.signIn.needsSignIn)
      ? null
      : new SharedMcpRefusal(Resources.formatSharedMcpSignInExpired(server.signIn.needsSignIn), Resources.sharedMcpSignInExpiredShort);
  }

  private static withBearer(definition: SharedMcpServerDefinition): SharedMcpServerDefinition {
    return new SharedMcpServerDefinition(definition.name, definition.transport, definition.command, definition.arguments, definition.variables,
      definition.url, definition.headers, Resources.sharedMcpAccessVariable);
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private static read(record: DataRecord): SharedMcpServer {
    return SharedMcpServer.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
