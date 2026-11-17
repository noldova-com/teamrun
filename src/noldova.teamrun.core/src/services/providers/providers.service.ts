/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import "@noldova/context.core";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  AuthStatus,
  DefaultTeammate,
  DiscoveredProfile,
  ErrorCode,
  Event,
  EventName,
  FirstLaunch,
  NameOrder,
  ProfileFolderName,
  ProfileFolderPath,
  Provider,
  type ProviderCreateParams,
  type ProviderEnabledParams,
  type ProviderIdParams,
  ProviderMcpServerList,
  type ProviderProfileDiscoverParams,
  ProviderProfileDiscovery,
  type ProviderSignInCommand,
  ProviderSignIns,
  type ProviderUpdateParams,
  Resources as ProtocolResources,
  SignInLinkPayload,
  Teammate,
  TeammateName,
  TeammateUpdateParams
} from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import { Guid } from "../../models/guid.js";
import { SignInCheck } from "../../models/sign-in-check.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";

export class ProvidersService implements IProvidersService {
  private readonly context: DatabaseContext;
  private readonly registry: ProviderKindRegistry;
  private readonly conversations: IConversationsService;
  private readonly events: IEventSink;
  private readonly signInTimeout: number;
  private readonly log: ILog | null;
  private readonly signIns: Map<string, AbortController> = new Map();
  private readonly signOuts: Map<string, string> = new Map();
  private readonly signOutRuns: Map<string, number> = new Map();
  private readonly discoveries: Map<string, Promise<ProviderProfileDiscovery>> = new Map();

  public constructor(context: DatabaseContext, registry: ProviderKindRegistry, conversations: IConversationsService, events: IEventSink,
    signInTimeout: number = Resources.signInTimeout, log: ILog | null = null) {
    this.context = context;
    this.registry = registry;
    this.conversations = conversations;
    this.events = events;
    this.signInTimeout = signInTimeout;
    this.log = log;
  }

  public async listAsync(transaction?: SqlTransaction): Promise<readonly Provider[]> {
    const records = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectProviders));
    return NameOrder.sort(records.map(t => ProvidersService.read(t)), t => t.kind, t => t.label);
  }

  public async findUsualAsync(kind: string, transaction?: SqlTransaction): Promise<Provider | null> {
    const usual = this.registry.has(kind) ? this.registry.get(kind).descriptor.profile?.usualFolder ?? null : null;
    return Object.isNull(usual) ? null : (await this.listAsync(transaction)).find(t => t.kind === kind && ProfileFolderPath.isSame(t.profileDir, usual)) ?? null;
  }

  public async findAsync(providerId: string, transaction?: SqlTransaction): Promise<Provider | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectProviderById, [providerId]));
    if (Object.isUndefined(record))
      return null;

    return ProvidersService.read(record);
  }

  public async createAsync(params: ProviderCreateParams): Promise<Provider> {
    if (!this.registry.has(params.kind))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatKindNotRegistered(params.kind), [params.kind]);
    if (!Object.isNull(params.profileDir) && !isAbsolute(params.profileDir))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProfileDirNotAbsolute(params.profileDir), [params.profileDir]);

    const profileDir = Object.isNull(params.profileDir) ? this.newProfileDir(params.kind, params.label) : resolve(params.profileDir);
    const now = new Date().toISOString();
    const id = Guid.createVersion7().toString();
    const ownMcpServers = Object.isNull(this.registry.get(params.kind).descriptor.ownMcpServersUnavailable);
    const provider = new Provider(id, params.kind, params.label, profileDir, AuthStatus.Unknown, null, null, null, null, now, true, ownMcpServers);
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.requireFreeFolderAsync(profileDir, null, transaction);
      await this.requireFreeKindAsync(params.kind, transaction);
      const json = JSON.stringify(provider.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertProvider, [provider.id, provider.kind, json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Provider, provider.id, ChangeOperation.Insert, json, transaction);
      if (Object.isNull(params.profileDir)) {
        ProvidersService.makeProfileDir(params.label, profileDir);
        this.prepareProfile(provider);
      }
      else
        this.prepareChosenProfile(provider);
    });
    return provider;
  }

  public async updateAsync(params: ProviderUpdateParams): Promise<Provider> {
    if (!isAbsolute(params.profileDir))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProfileDirNotAbsolute(params.profileDir), [params.profileDir]);
    const binaryPath = Object.isNull(params.binaryPath) ? null : params.binaryPath.trim();
    const chosen = Object.isNull(binaryPath) || binaryPath === String.empty ? null : binaryPath;
    if (!Object.isNull(chosen) && !isAbsolute(chosen))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatBinaryPathNotAbsolute(chosen), [chosen]);

    const updated = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireAsync(params.providerId, transaction);
      const unavailable = params.ownMcpServers === true ? this.registry.get(current.kind).descriptor.ownMcpServersUnavailable : null;
      if (!Object.isNull(unavailable))
        throw new ServiceException(ErrorCode.InvalidParams, unavailable, [current.kind]);
      if (!Object.isNull(chosen) && !this.registry.get(current.kind).descriptor.choosesServerPath)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatBinaryPathUnavailable(current.kind), [current.kind]);
      const moved = current.withProfile(params.label, resolve(params.profileDir));
      await this.requireFreeFolderAsync(moved.profileDir, moved.id, transaction);
      const kept = moved.profileDir === current.profileDir ? moved : moved.withOwnMcpServers(false);
      const switched = Object.isNull(params.ownMcpServers) ? kept : kept.withOwnMcpServers(params.ownMcpServers);
      const provider = Object.isNull(binaryPath) ? switched : switched.withBinaryPath(Object.isNull(chosen) ? null : resolve(chosen));
      if (provider.profileDir !== current.profileDir) {
        await this.conversations.resetProviderSessionsAsync(provider.id, transaction);
        this.prepareChosenProfile(provider);
      }
      const now = new Date().toISOString();
      const json = JSON.stringify(provider.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateProvider, [json, now, provider.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Provider, provider.id, ChangeOperation.Update, json, transaction);
      return provider;
    });
    this.events.publish(new Event(EventName.ProviderUpdated, updated.toJson()));
    return updated;
  }

  public async listOwnMcpServersAsync(params: ProviderIdParams): Promise<ProviderMcpServerList> {
    const provider = await this.requireAsync(params.providerId);
    const adapter = this.registry.get(provider.kind);
    const servers = Object.isUndefined(adapter.listOwnMcpServers) ? null : await adapter.listOwnMcpServers(provider);
    return new ProviderMcpServerList(provider.id, servers);
  }

  public async setEnabledAsync(params: ProviderEnabledParams): Promise<Provider> {
    const updated = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const provider = (await this.requireAsync(params.providerId, transaction)).withEnabled(params.enabled);
      const now = new Date().toISOString();
      const json = JSON.stringify(provider.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateProvider, [json, now, provider.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Provider, provider.id, ChangeOperation.Update, json, transaction);
      return provider;
    });
    if (!updated.enabled)
      this.signIns.get(updated.id)?.abort();
    this.events.publish(new Event(EventName.ProviderUpdated, updated.toJson()));
    return updated;
  }

  public async checkAsync(params: ProviderIdParams): Promise<Provider> {
    const provider = await this.requireEnabledAsync(params.providerId);
    if (this.signOuts.get(provider.id) === provider.profileDir)
      return provider;
    const signOutRuns = this.signOutRuns.get(provider.id);
    const check = await this.registry.get(provider.kind).checkSignIn(provider).catch((error: unknown) => {
      this.log?.write(Resources.formatSignInCheckFailed(provider.kind, provider.id, Resources.formatFailureKind(error)));
      throw error;
    });
    if (check.authStatus === AuthStatus.Error)
      this.log?.write(Resources.formatSignInCheckFailed(provider.kind, provider.id, Resources.signInCheckErrorKind));
    const now = new Date().toISOString();
    const checked = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireAsync(provider.id, transaction);
      if (current.profileDir !== provider.profileDir || this.signOutRuns.get(provider.id) !== signOutRuns)
        return null;

      const result = current.withCheck(check.authStatus, check.identity, check.harnessVersion, now, check.error);
      const json = JSON.stringify(result.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateProvider, [json, now, result.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Provider, result.id, ChangeOperation.Update, json, transaction);
      return result;
    });
    if (Object.isNull(checked))
      return await this.requireAsync(provider.id);

    this.events.publish(new Event(EventName.ProviderUpdated, checked.toJson()));
    return checked;
  }

  public async signInAsync(params: ProviderIdParams, signal?: AbortSignal): Promise<Provider> {
    const provider = await this.requireEnabledAsync(params.providerId);
    const adapter = this.registry.get(provider.kind);
    if (!adapter.descriptor.supportsSignIn)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatSignInUnavailable(adapter.descriptor.displayName), [provider.kind]);
    if (this.signIns.has(provider.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatSignInInProgress(provider.label), [provider.id]);
    if (this.signOuts.has(provider.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatSignOutInProgress(provider.label), [provider.id]);
    if (signal?.aborted === true)
      return provider;
    const controller = new AbortController();
    this.signIns.set(provider.id, controller);
    this.publishSignIns();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.signInTimeout);
    const stop = (): void => controller.abort();
    signal?.addEventListener(Resources.abortEvent, stop, { once: true });
    try {
      try {
        await adapter.signIn(provider, controller.signal, { openLink: url => this.events.publish(new Event(EventName.SignInLink, new SignInLinkPayload(provider.id, url).toJson())) });
      }
      catch (error) {
        if (!controller.signal.aborted)
          throw error;
        if (timedOut)
          throw new ServiceException(ErrorCode.Unavailable, Resources.formatSignInTimedOut(provider.label), [provider.id]);
        return await this.requireAsync(provider.id);
      }
      finally {
        clearTimeout(timer);
        signal?.removeEventListener(Resources.abortEvent, stop);
      }
      const current = await this.requireAsync(provider.id);
      return current.enabled ? await this.checkAsync(params) : current;
    }
    finally {
      this.signIns.delete(provider.id);
      this.publishSignIns();
    }
  }

  public async readSignInCommandAsync(params: ProviderIdParams): Promise<ProviderSignInCommand | null> {
    const provider = await this.requireEnabledAsync(params.providerId);
    return await this.registry.get(provider.kind).readSignInCommand?.(provider) ?? null;
  }

  public cancelSignIn(params: ProviderIdParams): void {
    this.signIns.get(params.providerId)?.abort();
  }

  public listSignIns(): ProviderSignIns {
    return new ProviderSignIns([...this.signIns.keys()]);
  }

  public async signOutAsync(params: ProviderIdParams): Promise<Provider> {
    const provider = await this.requireEnabledAsync(params.providerId);
    const adapter = this.registry.get(provider.kind);
    if (!adapter.descriptor.supportsSignOut || Object.isUndefined(adapter.signOut))
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatSignOutUnavailable(adapter.descriptor.displayName), [provider.kind]);
    if (this.signIns.has(provider.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatSignInInProgress(provider.label), [provider.id]);
    if (this.signOuts.has(provider.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatSignOutInProgress(provider.label), [provider.id]);
    this.signOuts.set(provider.id, provider.profileDir);
    this.signOutRuns.set(provider.id, (this.signOutRuns.get(provider.id) ?? 0) + 1);
    const failure = await adapter.signOut(provider).then(() => null, (error: unknown) => {
      this.log?.write(Resources.formatSignOutFailed(provider.kind, provider.id, Resources.formatFailureKind(error)));
      return { error };
    }).finally(() => this.signOuts.delete(provider.id));
    const current = await this.recordUnknownAsync(provider);
    const settled = current.profileDir !== provider.profileDir || !current.enabled ? current
      : await this.checkAsync(params).catch((error: unknown) => { throw Object.isNull(failure) ? error : failure.error; });
    const ownFolder = settled.profileDir === provider.profileDir;
    if (Object.isNull(failure)) {
      if (ownFolder && settled.authStatus === AuthStatus.LoggedIn)
        throw new ServiceException(ErrorCode.Unavailable, Resources.formatStillSignedIn(settled.label), [settled.id]);
      return settled;
    }
    if (ownFolder && settled.authStatus === AuthStatus.LoggedOut)
      return settled;
    throw failure.error;
  }

  public async discoverAsync(params: ProviderProfileDiscoverParams): Promise<ProviderProfileDiscovery> {
    const kinds = Object.isNull(params.kinds) ? this.registry.all().map(t => t.descriptor.id) : [...new Set(params.kinds)];
    const adapters = kinds.map(t => this.registry.get(t));
    const key = kinds.toSorted().join(Resources.discoveryKeySeparator);
    const discovery = this.discoveries.get(key) ?? this.startSearchAsync(key, adapters);
    const found = await discovery;
    const used = await this.usedFoldersAsync();
    return new ProviderProfileDiscovery(found.profiles.filter(u => !ProvidersService.isUsed(u.profileDir, used)));
  }

  public async deleteAsync(params: ProviderIdParams): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const provider = await this.requireAsync(params.providerId, transaction);
      await transaction.executeAsync(new SqlQuery(Resources.deleteProvider, [provider.id]));
      await transaction.executeAsync(new SqlQuery(Resources.deleteAccountLimit, [provider.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Provider, provider.id, ChangeOperation.Delete, JSON.stringify(provider.toJson()), transaction);
      await this.forgetDefaultTeammateOfAsync(provider.id, transaction);
      await this.forgetFallbacksOnAsync(provider.id, transaction);
    });
    this.signIns.get(params.providerId)?.abort();
  }

  public async readFirstLaunchAsync(transaction?: SqlTransaction): Promise<FirstLaunch> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectPreference, [Resources.firstLaunchPreference]));
    return Object.isUndefined(record) ? new FirstLaunch(null) : FirstLaunch.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }

  public async finishFirstLaunchAsync(): Promise<FirstLaunch> {
    return await this.context.database.connection.runInTransactionAsync(async transaction => {
      const previous = await this.readFirstLaunchAsync(transaction);
      if (previous.isFinished)
        return previous;
      const finished = new FirstLaunch(new Date().toISOString());
      const json = JSON.stringify(finished.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.upsertPreference, [Resources.firstLaunchPreference, json, finished.finishedAt]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, Resources.firstLaunchPreference, ChangeOperation.Insert, json, transaction);
      return finished;
    });
  }

  private startSearchAsync(key: string, adapters: readonly IProviderAdapter[]): Promise<ProviderProfileDiscovery> {
    const discovery = this.searchAsync(adapters).finally(() => this.discoveries.delete(key));
    this.discoveries.set(key, discovery);
    return discovery;
  }

  private async searchAsync(adapters: readonly IProviderAdapter[]): Promise<ProviderProfileDiscovery> {
    const used = await this.usedFoldersAsync();
    const found = adapters.flatMap(adapter => this.foldersOf(adapter).filter(t => !ProvidersService.isUsed(t, used)).map(t => this.profileOf(adapter, t)));
    const profiles = await Promise.all(found);
    const order = (profile: DiscoveredProfile): number => adapters.findIndex(t => t.descriptor.id === profile.kind);
    return new ProviderProfileDiscovery(profiles.toSorted((a, b) => order(a) - order(b) || Number(b.usual) - Number(a.usual) || a.label.localeCompare(b.label)));
  }

  private foldersOf(adapter: IProviderAdapter): readonly string[] {
    const search = adapter.profileSearch;
    if (Object.isUndefined(search))
      return [];
    const own = join(this.context.dataDirectory, ProtocolResources.profilesDirectoryName, adapter.descriptor.id);
    const places = [...search.folders.flatMap(t => [t, ...ProvidersService.foldersIn(dirname(t)).filter(u => basename(u).startsWith(basename(t)))]),
      ...ProvidersService.foldersIn(own)];
    return places.filter((t, index) => places.findIndex(u => ProfileFolderPath.isSame(u, t)) === index)
      .filter(t => !search.skipped.some(u => ProfileFolderPath.isSame(u, t)) && search.entries.some(u => existsSync(join(t, u))));
  }

  private async profileOf(adapter: IProviderAdapter, folder: string): Promise<DiscoveredProfile> {
    const descriptor = adapter.descriptor;
    const usualFolder = descriptor.profile?.usualFolder ?? null;
    const usual = !Object.isNull(usualFolder) && ProfileFolderPath.isSame(folder, usualFolder);
    const label = usual ? descriptor.displayName : basename(folder).replace(Resources.leadingDotsPattern, String.empty);
    const provider = new Provider(Guid.createVersion7().toString(), descriptor.id, label, folder, AuthStatus.Unknown, null, null, null, null, new Date().toISOString());
    const checking = adapter.checkFoundSignIn?.(provider) ?? Promise.resolve(new SignInCheck(AuthStatus.Unknown, null, null, null));
    const check = await checking.catch((error: unknown) => {
      this.log?.write(Resources.formatFoundProfileCheckFailed(descriptor.id, Resources.formatFailureKind(error)));
      return null;
    });
    return new DiscoveredProfile(descriptor.id, folder, label, usual, check?.authStatus ?? AuthStatus.Error, check?.identity ?? null);
  }

  private async usedFoldersAsync(): Promise<readonly string[]> {
    return (await this.listAsync()).map(t => t.profileDir);
  }

  private static isUsed(folder: string, used: readonly string[]): boolean {
    return used.some(t => ProfileFolderPath.isSame(t, folder));
  }

  private static foldersIn(directory: string): readonly string[] {
    try {
      return readdirSync(directory, { withFileTypes: true }).filter(t => t.isDirectory()).map(t => join(directory, t.name));
    }
    catch {
      return [];
    }
  }

  private newProfileDir(kind: string, label: string): string {
    const name = ProfileFolderName.of(label);
    if (Object.isNull(name))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProfileFolderNameless(label), [label]);

    return join(this.context.dataDirectory, ProtocolResources.profilesDirectoryName, kind, name);
  }

  private prepareProfile(provider: Provider): void {
    try {
      this.registry.get(provider.kind).prepareProfile?.(provider);
    }
    catch (error) {
      rmSync(provider.profileDir, { recursive: true, force: true });
      throw error;
    }
  }

  private prepareChosenProfile(provider: Provider): void {
    if (ProvidersService.isEmptyFolder(provider.profileDir))
      this.registry.get(provider.kind).prepareProfile?.(provider);
  }

  private static isEmptyFolder(folder: string): boolean {
    try {
      return readdirSync(folder).length === 0;
    }
    catch {
      return false;
    }
  }

  private static makeProfileDir(label: string, profileDir: string): void {
    mkdirSync(dirname(profileDir), { recursive: true, mode: Resources.profileDirectoryMode });
    try {
      mkdirSync(profileDir, { mode: Resources.profileDirectoryMode });
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === Resources.existsErrorCode)
        throw new ServiceException(ErrorCode.Conflict, Resources.formatProfileFolderExists(label, profileDir), [profileDir]);
      throw error;
    }
  }

  private async forgetDefaultTeammateOfAsync(providerId: string, transaction: SqlTransaction): Promise<void> {
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectPreference, [Resources.defaultTeammatePreference]));
    const json = record?.readString(Resources.jsonColumn) ?? null;
    if (Object.isNull(json) || DefaultTeammate.fromJson(JsonReader.parse(json).toJson()).providerId !== providerId)
      return;
    await transaction.executeAsync(new SqlQuery(Resources.deletePreference, [Resources.defaultTeammatePreference]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, Resources.defaultTeammatePreference, ChangeOperation.Delete, json, transaction);
  }

  private async forgetFallbacksOnAsync(providerId: string, transaction: SqlTransaction): Promise<void> {
    const now = new Date().toISOString();
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectTeammates))) {
      const teammate = Teammate.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
      const kept = teammate.fallbacks.filter(t => t.providerId !== providerId);
      if (kept.length === teammate.fallbacks.length)
        continue;
      const changed = TeammateUpdateParams.of(teammate.id, { fallbacks: kept }).applyTo(teammate, now);
      const json = JSON.stringify(changed.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateTeammate, [TeammateName.key(changed.name), json, now, changed.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Teammate, changed.id, ChangeOperation.Update, json, transaction);
    }
  }

  private publishSignIns(): void {
    this.events.publish(new Event(EventName.ProviderSignInsChanged, this.listSignIns().toJson()));
  }

  private async recordUnknownAsync(provider: Provider): Promise<Provider> {
    const now = new Date().toISOString();
    const [current, unknown] = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireAsync(provider.id, transaction);
      if (current.profileDir !== provider.profileDir || current.enabled)
        return [current, null] as const;
      const unknown = current.withCheck(AuthStatus.Unknown, null, current.harnessVersion, current.lastCheckedAt, null);
      const json = JSON.stringify(unknown.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateProvider, [json, now, unknown.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Provider, unknown.id, ChangeOperation.Update, json, transaction);
      return [current, unknown] as const;
    });
    if (Object.isNull(unknown))
      return current;
    this.events.publish(new Event(EventName.ProviderUpdated, unknown.toJson()));
    return unknown;
  }

  private async requireEnabledAsync(providerId: string): Promise<Provider> {
    const provider = await this.requireAsync(providerId);
    if (!provider.enabled)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatProviderDisabled(provider.label), [provider.id]);

    return provider;
  }

  private async requireAsync(providerId: string, transaction?: SqlTransaction): Promise<Provider> {
    const provider = await this.findAsync(providerId, transaction);
    if (Object.isNull(provider))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotFound(providerId), [providerId]);

    return provider;
  }

  private async requireFreeKindAsync(kind: string, transaction: SqlTransaction): Promise<void> {
    const single = this.registry.get(kind).descriptor.singleAccount;
    if (!Object.isNull(single) && (await this.listAsync(transaction)).some(t => t.kind === kind))
      throw new ServiceException(ErrorCode.Conflict, single, [kind]);
  }

  private async requireFreeFolderAsync(profileDir: string, providerId: string | null, transaction: SqlTransaction): Promise<void> {
    const owner = (await this.listAsync(transaction)).find(t => t.id !== providerId && ProfileFolderPath.isSame(t.profileDir, profileDir));
    if (!Object.isUndefined(owner))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatProfileFolderInUse(owner.label, profileDir), [profileDir]);
  }

  private static read(record: DataRecord): Provider {
    return Provider.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
