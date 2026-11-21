/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { DepartmentCreateParams, DepartmentIdParams, DepartmentMemberSetParams, DepartmentMoveParams, DepartmentUpdateParams, EventName, MethodName, Organization }
  from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class OrganizationStoreService {
  public static readonly provider: FactoryProvider =
    { provide: OrganizationStoreService, useFactory: (): OrganizationStoreService => OrganizationStoreService.of(inject(WindowPartTokens.context)) };

  private static readonly stores: WeakMap<IWindowPartContext, OrganizationStoreService> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly organizationSignal: WritableSignal<Organization> = signal(Organization.empty);
  private readonly loadErrorSignal: WritableSignal<string | null> = signal(null);
  private readonly actionErrorSignal: WritableSignal<string | null> = signal(null);
  private readonly subscriptions: readonly (() => void)[];
  private generation: number = 0;

  public readonly organization: Signal<Organization> = this.organizationSignal.asReadonly();
  public readonly loadError: Signal<string | null> = this.loadErrorSignal.asReadonly();
  public readonly actionError: Signal<string | null> = this.actionErrorSignal.asReadonly();

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.OrganizationChanged), t => this.apply(Organization.fromJson(t))),
      context.onEvent(Resources.formatQualifiedName(EventName.StateResyncRequested), () => void this.reload())
    ];
    void this.reload();
  }

  public static of(context: IWindowPartContext): OrganizationStoreService {
    const found = OrganizationStoreService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new OrganizationStoreService(context);
    OrganizationStoreService.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
    OrganizationStoreService.stores.get(context)?.dispose();
    OrganizationStoreService.stores.delete(context);
  }

  public async reload(): Promise<void> {
    const generation = ++this.generation;
    try {
      const organization = Organization.fromJson(await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationList), null));
      if (generation === this.generation)
        this.apply(organization);
    }
    catch (error) {
      if (generation === this.generation)
        this.loadErrorSignal.set(OrganizationStoreService.messageOf(error));
    }
  }

  public async createDepartment(name: string, parentId: string | null): Promise<boolean> {
    return this.act(MethodName.DepartmentCreate, new DepartmentCreateParams(name, parentId).toJson());
  }

  public async renameDepartment(departmentId: string, name: string): Promise<boolean> {
    return this.act(MethodName.DepartmentUpdate, new DepartmentUpdateParams(departmentId, name, undefined).toJson());
  }

  public async setLeader(departmentId: string, leaderId: string | null): Promise<boolean> {
    return this.act(MethodName.DepartmentUpdate, new DepartmentUpdateParams(departmentId, undefined, leaderId).toJson());
  }

  public async moveDepartment(departmentId: string, parentId: string | null, order: number): Promise<boolean> {
    return this.act(MethodName.DepartmentMove, new DepartmentMoveParams(departmentId, parentId, order).toJson());
  }

  public async deleteDepartment(departmentId: string): Promise<boolean> {
    return this.act(MethodName.DepartmentDelete, new DepartmentIdParams(departmentId).toJson());
  }

  public async setMember(teammateId: string, departmentId: string | null): Promise<boolean> {
    return this.act(MethodName.DepartmentMemberSet, new DepartmentMemberSetParams(teammateId, departmentId).toJson());
  }

  public fail(error: unknown): void {
    this.actionErrorSignal.set(OrganizationStoreService.messageOf(error));
  }

  public clearActionError(): void {
    this.actionErrorSignal.set(null);
  }

  private async act(method: MethodName, parameters: JsonValue): Promise<boolean> {
    this.actionErrorSignal.set(null);
    try {
      await this.context.requestAsync(Resources.formatQualifiedName(method), parameters);
      return true;
    }
    catch (error) {
      this.actionErrorSignal.set(OrganizationStoreService.messageOf(error));
      return false;
    }
  }

  private apply(organization: Organization): void {
    this.generation++;
    this.organizationSignal.set(organization);
    this.loadErrorSignal.set(null);
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private dispose(): void {
    this.generation++;
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }
}
