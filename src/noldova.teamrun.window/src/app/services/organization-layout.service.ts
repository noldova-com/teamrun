/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type FactoryProvider, inject, type Signal } from "@angular/core";

import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

import type { OrganizationCardField } from "../enums/organization-card-field";
import type { OrganizationLayout } from "../models/organization-layout";
import { OrganizationLayoutState } from "./organization-layout-state";
import { OrganizationScope } from "./organization-scope";

export class OrganizationLayoutService {
  public static readonly provider: FactoryProvider = {
    provide: OrganizationLayoutService,
    useFactory: (): OrganizationLayoutService => inject(OrganizationLayoutService, { skipSelf: true, optional: true })
      ?? new OrganizationLayoutService(inject(WindowPartTokens.context), inject(OrganizationScope, { optional: true }) ?? new OrganizationScope())
  };

  private readonly state: Signal<OrganizationLayoutState>;

  public readonly layout: Signal<OrganizationLayout>;

  public constructor(context: IWindowPartContext, scope: OrganizationScope) {
    this.state = computed(() => OrganizationLayoutState.of(context, scope.id()));
    this.layout = computed(() => this.state().layout());
  }

  public static release(context: IWindowPartContext): void {
    OrganizationLayoutState.release(context);
  }

  public toggleDepartment(departmentId: string): void {
    this.state().toggleDepartment(departmentId);
  }

  public showOnEveryCard(field: OrganizationCardField, shown: boolean): void {
    this.state().showOnEveryCard(field, shown);
  }

  public showOnCard(teammateId: string, field: OrganizationCardField, shown: boolean): void {
    this.state().showOnCard(teammateId, field, shown);
  }

  public clearCard(teammateId: string): void {
    this.state().clearCard(teammateId);
  }

  public clearEveryCard(): void {
    this.state().clearEveryCard();
  }
}
