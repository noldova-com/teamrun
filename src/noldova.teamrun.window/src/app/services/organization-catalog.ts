/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { type IWindowPartContext, RuntimeRequestException } from "@noldova/desktop.window";
import { EventName, MethodName, Organization, OrganizationIdParams, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ListNotArrayException } from "../exceptions/list-not-array.exception";
import { EngineResync } from "./engine-resync";

export class OrganizationCatalog {
  private static readonly catalogs: WeakMap<IWindowPartContext, OrganizationCatalog> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly organizationsSignal: WritableSignal<readonly Organization[]> = signal([]);
  private readonly loadErrorSignal: WritableSignal<string | null> = signal(null);
  private readonly listedSignal: WritableSignal<boolean> = signal(false);
  private readonly subscriptions: readonly (() => void)[];
  private generation: number = 0;
  private changes: Map<string, Organization | null> = new Map();
  private loading: Promise<void> = Promise.resolve();

  public readonly organizations: Signal<readonly Organization[]> = this.organizationsSignal.asReadonly();
  public readonly loadError: Signal<string | null> = this.loadErrorSignal.asReadonly();
  public readonly listed: Signal<boolean> = this.listedSignal.asReadonly();

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.OrganizationChanged), t => this.change(Organization.fromJson(t))),
      context.onEvent(Resources.formatQualifiedName(EventName.OrganizationRemoved), t => this.remove(OrganizationIdParams.fromJson(t).organizationId)),
      EngineResync.on(context, () => void this.reload())
    ];
    void this.reload();
  }

  public static of(context: IWindowPartContext): OrganizationCatalog {
    const found = OrganizationCatalog.catalogs.get(context);
    if (!Object.isUndefined(found))
      return found;
    const catalog = new OrganizationCatalog(context);
    OrganizationCatalog.catalogs.set(context, catalog);
    return catalog;
  }

  public static release(context: IWindowPartContext): void {
    OrganizationCatalog.catalogs.get(context)?.dispose();
    OrganizationCatalog.catalogs.delete(context);
  }

  public async firstAsync(): Promise<Organization | null> {
    for (let loading = this.loading; this.organizationsSignal().length === 0; loading = this.loading) {
      await loading;
      if (loading === this.loading)
        break;
    }
    return this.organizationsSignal().at(0) ?? null;
  }

  public reload(): Promise<void> {
    this.loading = this.load();
    return this.loading;
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const changes = new Map<string, Organization | null>();
    this.changes = changes;
    try {
      const value = await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationList), null);
      if (!Array.isArray(value))
        throw new ListNotArrayException(Resources.formatValueKind(value));
      const organizations = value.map(t => Organization.fromJson(t));
      if (generation === this.generation) {
        this.set([...organizations.filter(t => !changes.has(t.id)), ...[...changes.values()].flatMap(t => Object.isNull(t) ? [] : [t])]);
        this.listedSignal.set(true);
      }
    }
    catch (error) {
      if (!(error instanceof RuntimeRequestException || error instanceof ListNotArrayException || error instanceof JsonException || error instanceof ArgumentException))
        throw error;
      if (generation === this.generation)
        this.loadErrorSignal.set(error.message);
    }
  }

  private change(organization: Organization): void {
    this.changes.set(organization.id, organization);
    this.set([...this.organizationsSignal().filter(t => t.id !== organization.id), organization]);
  }

  private remove(organizationId: string): void {
    this.changes.set(organizationId, null);
    this.set(this.organizationsSignal().filter(t => t.id !== organizationId));
    this.context.closeDocument(Resources.organizationDocumentName, organizationId);
    if (organizationId === ProtocolResources.defaultOrganizationId)
      this.context.closeDocument(Resources.organizationDocumentName, Resources.organizationOldDocumentInstance);
  }

  private set(organizations: readonly Organization[]): void {
    this.organizationsSignal.set([...organizations].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)));
    this.loadErrorSignal.set(null);
  }

  private dispose(): void {
    this.generation++;
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }
}
