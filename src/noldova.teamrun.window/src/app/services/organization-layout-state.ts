/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { EventName, MethodName, OrganizationIdParams, OrganizationLayoutSaveParams } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { OrganizationCardField } from "../enums/organization-card-field";
import { OrganizationLayout } from "../models/organization-layout";
import { EngineResync } from "./engine-resync";

export class OrganizationLayoutState {
  private static readonly states: WeakMap<IWindowPartContext, Map<string, OrganizationLayoutState>> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly organizationId: string;
  private readonly current: WritableSignal<OrganizationLayout> = signal(new OrganizationLayout());
  private readonly subscriptions: readonly (() => void)[];
  private readonly held: ((layout: OrganizationLayout) => OrganizationLayout)[] = [];
  private isOpen: boolean = false;
  private isReading: boolean = false;
  private edits: number = 0;
  private received: number = 0;
  private saving: number = 0;
  private saved: Promise<void> = Promise.resolve();

  public readonly layout: Signal<OrganizationLayout> = this.current.asReadonly();

  public constructor(context: IWindowPartContext, organizationId: string) {
    this.context = context;
    this.organizationId = organizationId;
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.OrganizationLayoutUpdated), t => {
        const saved = OrganizationLayoutSaveParams.fromJson(t);
        if (saved.organizationId !== this.organizationId)
          return;
        this.received++;
        const latest = OrganizationLayout.fromJson(saved.layout);
        if (!this.isOpen)
          this.openWith(latest);
        else if (this.saving === 0)
          this.current.set(latest);
      }),
      EngineResync.on(context, () => void this.load())
    ];
    void this.open();
  }

  public static of(context: IWindowPartContext, organizationId: string): OrganizationLayoutState {
    const states = OrganizationLayoutState.states.get(context) ?? new Map<string, OrganizationLayoutState>();
    OrganizationLayoutState.states.set(context, states);
    const found = states.get(organizationId);
    if (!Object.isUndefined(found))
      return found;
    const state = new OrganizationLayoutState(context, organizationId);
    states.set(organizationId, state);
    return state;
  }

  public static release(context: IWindowPartContext): void {
    for (const state of OrganizationLayoutState.states.get(context)?.values() ?? [])
      state.dispose();
    OrganizationLayoutState.states.delete(context);
  }

  public toggleDepartment(departmentId: string): void {
    this.update(t => t.toggleDepartment(departmentId));
  }

  public showOnEveryCard(field: OrganizationCardField, shown: boolean): void {
    this.update(t => t.withCardsShow(field, shown));
  }

  public showOnCard(teammateId: string, field: OrganizationCardField, shown: boolean): void {
    this.update(t => t.withCardField(teammateId, field, shown));
  }

  public clearCard(teammateId: string): void {
    this.update(t => t.withoutCardFields(teammateId));
  }

  public clearEveryCard(): void {
    this.update(t => t.withoutAnyCardFields());
  }

  private update(change: (layout: OrganizationLayout) => OrganizationLayout): void {
    const next = change(this.current());
    this.edits++;
    this.current.set(next);
    if (this.isOpen)
      this.save(next.toJson());
    else {
      this.held.push(change);
      if (!this.isReading)
        void this.open();
    }
  }

  private async open(): Promise<void> {
    this.isReading = true;
    const kept = await this.read();
    this.isReading = false;
    if (!this.isOpen && !Object.isUndefined(kept))
      this.openWith(OrganizationLayout.fromJson(kept));
  }

  private openWith(base: OrganizationLayout): void {
    this.isOpen = true;
    const held = this.held.splice(0);
    this.current.set(held.reduce((layout, change) => change(layout), base));
    if (held.length > 0)
      this.save(this.current().toJson());
  }

  private async load(): Promise<void> {
    const [edits, received] = [this.edits, this.received];
    const kept = await this.read();
    if (Object.isUndefined(kept))
      return;
    if (!this.isOpen)
      this.openWith(OrganizationLayout.fromJson(kept));
    else if (!Object.isNull(kept) && edits === this.edits && received === this.received && this.saving === 0)
      this.current.set(OrganizationLayout.fromJson(kept));
  }

  private read(): Promise<JsonValue | undefined> {
    return this.request(MethodName.OrganizationLayoutRead, new OrganizationIdParams(this.organizationId).toJson()).catch(() => undefined);
  }

  private save(layout: JsonObject): void {
    this.saving++;
    this.saved = this.saved.then(() => this.request(MethodName.OrganizationLayoutSave, new OrganizationLayoutSaveParams(this.organizationId, layout).toJson()))
      .then(() => undefined, () => undefined)
      .finally(() => this.saving--);
  }

  private request(method: MethodName, parameters: JsonValue): Promise<JsonValue> {
    return this.context.requestAsync(Resources.formatQualifiedName(method), parameters);
  }

  private dispose(): void {
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }
}
