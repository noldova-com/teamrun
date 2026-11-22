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
import { EventName, Message, MessageAuthor, MessageStatus } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { OrganizationFlowStage } from "../enums/organization-flow-stage";
import { OrganizationFlow } from "../models/organization-flow";
import { ClockService } from "./clock.service";
import { MotionPreferenceService } from "./motion-preference.service";

export class OrganizationFlowService {
  public static readonly provider: FactoryProvider = {
    provide: OrganizationFlowService,
    useFactory: (): OrganizationFlowService => OrganizationFlowService.of(inject(WindowPartTokens.context), inject(MotionPreferenceService).reduced, inject(ClockService))
  };

  private static readonly services: WeakMap<IWindowPartContext, OrganizationFlowService> = new WeakMap();
  private static readonly underway: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];
  private static readonly ended: readonly MessageStatus[] = [MessageStatus.Failed, MessageStatus.Cancelled, MessageStatus.Interrupted];
  private static readonly sentDuration: number = Resources.organizationFlowPulseDuration + Resources.organizationFlowGlowDuration;

  private readonly reduced: Signal<boolean>;
  private readonly enabledSignal: WritableSignal<boolean> = signal(true);
  private readonly allSignal: WritableSignal<readonly OrganizationFlow[]> = signal([]);
  private readonly writers: Map<string, string> = new Map();
  private readonly started: Set<string> = new Set();
  private readonly clock: ClockService;
  private readonly endings: Map<string, () => void> = new Map();
  private readonly subscriptions: readonly (() => void)[];

  public readonly flows: Signal<readonly OrganizationFlow[]> = computed(() => this.isShown() ? this.allSignal() : []);

  private constructor(context: IWindowPartContext, reduced: Signal<boolean>, clock: ClockService) {
    this.reduced = reduced;
    this.clock = clock;
    this.subscriptions = [
      context.onSettingChanged(Resources.organizationMessageFlowSetting, t => this.applyEnabled(t)),
      ...[EventName.MessageCreated, EventName.MessageUpdated].map(t => context.onEvent(Resources.formatQualifiedName(t), u => this.follow(Message.fromJson(u))))
    ];
    this.applyEnabled(context.readSetting(Resources.organizationMessageFlowSetting));
  }

  public static of(context: IWindowPartContext, reduced: Signal<boolean>, clock: ClockService): OrganizationFlowService {
    const found = OrganizationFlowService.services.get(context);
    if (!Object.isUndefined(found))
      return found;
    const service = new OrganizationFlowService(context, reduced, clock);
    OrganizationFlowService.services.set(context, service);
    return service;
  }

  public static release(context: IWindowPartContext): void {
    const service = OrganizationFlowService.services.get(context);
    service?.subscriptions.forEach(t => t());
    service?.stopEndings();
    OrganizationFlowService.services.delete(context);
  }

  public arrive(id: string): void {
    this.allSignal.update(t => t.map(u => u.id === id && u.stage === OrganizationFlowStage.Sent ? u.withStage(OrganizationFlowStage.Arrived) : u));
  }

  public finish(id: string): void {
    this.allSignal.update(t => t.filter(u => u.id !== id || u.isMoving));
  }

  private isShown(): boolean {
    return this.enabledSignal() && !this.reduced();
  }

  private applyEnabled(value: JsonValue | undefined): void {
    this.enabledSignal.set(value !== false);
    if (value === false) {
      this.allSignal.set([]);
      this.stopEndings();
    }
  }

  private stopEndings(): void {
    this.endings.forEach(t => t());
    this.endings.clear();
  }

  private endAfter(id: string, duration: number): void {
    this.endings.set(id, this.clock.after(duration, () => {
      this.endings.delete(id);
      this.allSignal.update(t => t.filter(u => u.id !== id || u.stage === OrganizationFlowStage.Writing));
    }));
  }

  private follow(message: Message): void {
    this.remember(message);
    if (Object.isNull(message.inReplyTo) || Object.isNull(message.teammateId) || message.author !== MessageAuthor.Provider)
      return;
    const writer = this.writers.get(message.inReplyTo);
    if (Object.isUndefined(writer) || writer === message.teammateId)
      return;
    const inbound = Resources.formatOrganizationFlowId(message.id, false);
    const outbound = Resources.formatOrganizationFlowId(message.id, true);
    if (!this.isShown()) {
      this.allSignal.update(t => t.filter(u => u.id !== inbound && u.id !== outbound));
      return;
    }
    if (message.status === MessageStatus.Pending && writer === Resources.organizationFlowPersonKey)
      this.put(new OrganizationFlow(inbound, writer, message.teammateId, OrganizationFlowStage.Writing));
    else if (OrganizationFlowService.underway.includes(message.status) && this.start(inbound)) {
      this.put(new OrganizationFlow(inbound, writer, message.teammateId, OrganizationFlowStage.Sent));
      this.endAfter(inbound, OrganizationFlowService.sentDuration);
    }
    if (message.status === MessageStatus.Running)
      this.put(new OrganizationFlow(outbound, message.teammateId, writer, OrganizationFlowStage.Writing));
    else if (message.status === MessageStatus.Completed)
      this.settle(outbound, OrganizationFlowStage.Sent, OrganizationFlowService.sentDuration);
    else if (OrganizationFlowService.ended.includes(message.status))
      this.settle(outbound, OrganizationFlowStage.Abandoned, Resources.organizationFlowFadeDuration);
  }

  private remember(message: Message): void {
    const writer = OrganizationFlowService.writerOf(message);
    if (Object.isNull(writer) || this.writers.has(message.id))
      return;
    this.writers.set(message.id, writer);
    OrganizationFlowService.forgetOldest(this.writers);
  }

  private static writerOf(message: Message): string | null {
    if (!Object.isNull(message.sender))
      return message.sender.teammateId;
    if (message.author === MessageAuthor.User)
      return Resources.organizationFlowPersonKey;
    return message.author === MessageAuthor.Provider ? message.teammateId : null;
  }

  private start(id: string): boolean {
    if (this.started.has(id))
      return false;
    this.started.add(id);
    OrganizationFlowService.forgetOldest(this.started);
    return true;
  }

  private static forgetOldest(kept: Map<string, string> | Set<string>): void {
    for (const id of [...kept.keys()].slice(0, Math.max(0, kept.size - Resources.organizationFlowRemembered)))
      kept.delete(id);
  }

  private settle(id: string, stage: OrganizationFlowStage, duration: number): void {
    if (!this.allSignal().some(t => t.id === id && t.stage === OrganizationFlowStage.Writing))
      return;
    this.allSignal.update(t => t.map(u => u.id === id && u.stage === OrganizationFlowStage.Writing ? u.withStage(stage) : u));
    this.endAfter(id, duration);
  }

  private put(flow: OrganizationFlow): void {
    if (this.allSignal().some(t => t.id === flow.id && t.stage === flow.stage))
      return;
    this.allSignal.update(t => [...t.filter(u => u.id !== flow.id), flow].slice(-Resources.organizationFlowRemembered));
  }
}
