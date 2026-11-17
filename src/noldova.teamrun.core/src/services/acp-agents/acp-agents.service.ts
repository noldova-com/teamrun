/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { type AcpAgentIdParams, type AcpAgentListing, type AcpLocalCommandAddParams, ErrorCode, Event, EventName, type ProviderKind } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IAcpAgentCatalog } from "../../interfaces/i-acp-agent-catalog.js";
import type { IAcpAgentsService } from "../../interfaces/i-acp-agents.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IProviderKindsService } from "../../interfaces/i-provider-kinds.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { ISharedMcpSecrets } from "../../interfaces/i-shared-mcp-secrets.js";
import { AcpStoredAgent } from "../../models/acp-stored-agent.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";

export class AcpAgentsService implements IAcpAgentsService {
  private readonly context: DatabaseContext;
  private readonly registry: ProviderKindRegistry;
  private readonly kinds: IProviderKindsService;
  private readonly providers: IProvidersService;
  private readonly catalog: IAcpAgentCatalog;
  private readonly secrets: ISharedMcpSecrets;
  private readonly events: IEventSink;
  private readonly log: ILog | null;

  public constructor(context: DatabaseContext, registry: ProviderKindRegistry, kinds: IProviderKindsService, providers: IProvidersService, catalog: IAcpAgentCatalog,
    secrets: ISharedMcpSecrets, events: IEventSink, log: ILog | null = null) {
    this.context = context;
    this.registry = registry;
    this.kinds = kinds;
    this.providers = providers;
    this.catalog = catalog;
    this.secrets = secrets;
    this.events = events;
    this.log = log;
  }

  public async startAsync(): Promise<void> {
    for (const stored of await this.readAllAsync()) {
      try {
        this.registry.register(await this.catalog.openAsync(stored, t => this.saveAsync(stored, t)));
      }
      catch (error) {
        this.log?.write(Resources.formatAcpAgentNotOpened(stored.kind, AcpAgentsService.describe(error)));
      }
    }
  }

  public async listAsync(): Promise<AcpAgentListing> {
    return this.catalog.listAsync(await this.readAllAsync());
  }

  public readIconAsync(params: AcpAgentIdParams): Promise<string | null> {
    return this.catalog.readIconAsync(params.id);
  }

  public async addAsync(params: AcpAgentIdParams): Promise<ProviderKind> {
    if (this.registry.has(params.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatAcpAgentAlreadyAdded(params.id), [params.id]);
    const offer = await this.catalog.readOfferAsync(params.id);
    if (Object.isNull(offer))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatAcpAgentNotListed(params.id), [params.id]);
    if (!Object.isNull(offer.unavailable))
      throw new ServiceException(ErrorCode.Unavailable, offer.unavailable, [params.id]);
    return this.addStoredAsync(offer.stored);
  }

  public addLocalAsync(params: AcpLocalCommandAddParams): Promise<ProviderKind> {
    return this.addStoredAsync(this.catalog.localOf(params, t => this.registry.has(t)));
  }

  public async removeAsync(params: AcpAgentIdParams): Promise<void> {
    const stored = (await this.readAllAsync()).find(t => t.kind === params.id);
    if (Object.isUndefined(stored))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatAcpAgentNotListed(params.id), [params.id]);
    if ((await this.providers.listAsync()).some(t => t.kind === stored.kind))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatAcpAgentInUse(stored.name), [stored.kind]);
    if (this.kinds.isInstalling(stored.kind))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatAcpAgentInstalling(stored.name), [stored.kind]);
    const adapter = this.registry.unregister(stored.kind);
    await adapter?.shutdown();
    const references = this.catalog.referencesOf(stored);
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      await transaction.executeAsync(new SqlQuery(Resources.deleteAcpAgent, [stored.kind]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.AcpAgent, stored.kind, ChangeOperation.Delete, JSON.stringify({ [Resources.kindColumn]: stored.kind }), transaction);
    });
    for (const reference of references)
      void this.secrets.removeAsync(reference).catch((error: unknown) => this.log?.write(Resources.formatAcpAgentSecretKept(stored.kind, AcpAgentsService.describe(error))));
    await this.catalog.removeFilesAsync(stored);
    this.publishChanged();
  }

  private async addStoredAsync(stored: AcpStoredAgent): Promise<ProviderKind> {
    const adapter = await this.catalog.openAsync(stored, t => this.saveAsync(stored, t));
    const now = new Date().toISOString();
    const json = JSON.stringify(stored.json);
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      await transaction.executeAsync(new SqlQuery(Resources.insertAcpAgent, [stored.kind, stored.name, json, now, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.AcpAgent, stored.kind, ChangeOperation.Insert, json, transaction);
    });
    this.registry.register(adapter);
    this.publishChanged();
    return adapter.descriptor;
  }

  private async saveAsync(stored: AcpStoredAgent, value: JsonObject): Promise<void> {
    const json = JSON.stringify(value);
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      await transaction.executeAsync(new SqlQuery(Resources.updateAcpAgent, [json, new Date().toISOString(), stored.kind]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.AcpAgent, stored.kind, ChangeOperation.Update, json, transaction);
    });
  }

  private async readAllAsync(): Promise<readonly AcpStoredAgent[]> {
    return (await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectAcpAgents))).map(t => AcpAgentsService.read(t));
  }

  private publishChanged(): void {
    this.events.publish(new Event(EventName.ProviderKindsChanged, null));
  }

  private static read(record: DataRecord): AcpStoredAgent {
    return new AcpStoredAgent(record.readString(Resources.kindColumn), record.readString(Resources.nameColumn), JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
