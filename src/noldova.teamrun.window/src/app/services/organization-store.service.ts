/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type FactoryProvider, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { Conversation, DepartmentCreateParams, DepartmentIdParams, DepartmentMemberSetParams, DepartmentMoveParams, DepartmentUpdateParams, MethodName,
  Organization, OrganizationChat, OrganizationParent } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { OrganizationCatalog } from "./organization-catalog";
import { OrganizationScope } from "./organization-scope";

export class OrganizationStoreService {
  public static readonly provider: FactoryProvider = {
    provide: OrganizationStoreService,
    useFactory: (): OrganizationStoreService => inject(OrganizationStoreService, { skipSelf: true, optional: true })
      ?? new OrganizationStoreService(inject(WindowPartTokens.context), inject(OrganizationScope, { optional: true }) ?? new OrganizationScope())
  };

  private readonly context: IWindowPartContext;
  private readonly catalog: OrganizationCatalog;
  private readonly actionErrorSignal: WritableSignal<string | null> = signal(null);

  public readonly id: Signal<string>;
  public readonly organization: Signal<Organization>;
  public readonly loadError: Signal<string | null>;
  public readonly actionError: Signal<string | null> = this.actionErrorSignal.asReadonly();

  public constructor(context: IWindowPartContext, scope: OrganizationScope) {
    this.context = context;
    this.catalog = OrganizationCatalog.of(context);
    this.id = scope.id;
    this.loadError = this.catalog.loadError;
    this.organization = computed(() => {
      const id = this.id();
      return this.catalog.organizations().find(t => t.id === id) ?? OrganizationStoreService.unloaded(id);
    });
  }

  public static release(context: IWindowPartContext): void {
    OrganizationCatalog.release(context);
  }

  public reload(): Promise<void> {
    return this.catalog.reload();
  }

  public async createDepartment(name: string, parentId: string | null): Promise<boolean> {
    return this.act(MethodName.DepartmentCreate, new DepartmentCreateParams(this.id(), name, OrganizationParent.departmentOrPerson(parentId)).toJson());
  }

  public async renameDepartment(departmentId: string, name: string): Promise<boolean> {
    return this.act(MethodName.DepartmentUpdate, new DepartmentUpdateParams(this.id(), departmentId, name, undefined).toJson());
  }

  public async setLeader(departmentId: string, leaderId: string | null): Promise<boolean> {
    return this.act(MethodName.DepartmentUpdate, new DepartmentUpdateParams(this.id(), departmentId, undefined, leaderId).toJson());
  }

  public async moveDepartment(departmentId: string, parentId: string | null, order: number): Promise<boolean> {
    return this.act(MethodName.DepartmentMove,
      new DepartmentMoveParams(this.id(), departmentId, OrganizationParent.departmentOrPerson(parentId), order).toJson());
  }

  public async deleteDepartment(departmentId: string): Promise<boolean> {
    return this.act(MethodName.DepartmentDelete, new DepartmentIdParams(this.id(), departmentId).toJson());
  }

  public async setMember(teammateId: string, departmentId: string | null): Promise<boolean> {
    return this.act(MethodName.DepartmentMemberSet, new DepartmentMemberSetParams(this.id(), teammateId, departmentId).toJson());
  }

  public async openOrganizationChat(teammateId: string): Promise<Conversation | null> {
    this.actionErrorSignal.set(null);
    try {
      return Conversation.fromJson(await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationChatOpen),
        new OrganizationChat(this.id(), teammateId).toJson()));
    }
    catch (error) {
      this.actionErrorSignal.set(OrganizationStoreService.messageOf(error));
      return null;
    }
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

  private static unloaded(id: string): Organization {
    return new Organization(id, Resources.organizationTitle, null, 0, Resources.organizationUnloadedTime, Resources.organizationUnloadedTime, [], []);
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
