/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IPermissionAnswerer,
  type IPermissionDetail,
  type IPermissionRequest,
  PermissionDecision,
  PermissionDetailKind as DesktopDetailKind,
  PermissionOption,
  type PermissionQuestion,
  ToolRisk
} from "@noldova/desktop.runtime";
import { type IPermissionAsker, PermissionAnswer, PermissionAsk } from "@noldova/teamrun.core";
import { PermissionDetail, PermissionDetailKind, PermissionPayload, PermissionRisk } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { ServedCalls } from "./served-calls.js";

export class PermissionAnswerer implements IPermissionAnswerer {
  private static readonly RISKS: ReadonlyMap<ToolRisk, PermissionRisk> = new Map([
    [ToolRisk.Low, PermissionRisk.Low],
    [ToolRisk.Medium, PermissionRisk.Medium],
    [ToolRisk.High, PermissionRisk.High]
  ]);
  private static readonly DECISIONS: Readonly<Record<PermissionAnswer, PermissionDecision>> = {
    [PermissionAnswer.AllowedOnce]: PermissionDecision.AllowedOnce,
    [PermissionAnswer.AllowedAlways]: PermissionDecision.AllowedAlways,
    [PermissionAnswer.Denied]: PermissionDecision.Denied,
    [PermissionAnswer.TakenOver]: PermissionDecision.TakenOver
  };
  private static readonly KINDS: ReadonlyMap<DesktopDetailKind, PermissionDetailKind> = new Map([
    [DesktopDetailKind.Text, PermissionDetailKind.Text],
    [DesktopDetailKind.Code, PermissionDetailKind.Code],
    [DesktopDetailKind.Secret, PermissionDetailKind.Secret],
    [DesktopDetailKind.AgentText, PermissionDetailKind.AgentText]
  ]);

  private readonly asker: IPermissionAsker;
  private readonly calls: ServedCalls;

  public constructor(asker: IPermissionAsker, calls: ServedCalls = new ServedCalls()) {
    this.asker = asker;
    this.calls = calls;
  }

  public async answerAsync(question: PermissionQuestion, signal: AbortSignal): Promise<PermissionDecision> {
    const request = question.request;
    const remembersInChat = PermissionAnswerer.remembersInChat(question);
    const offersAllowOnce = request.options.includes(PermissionOption.AllowOnce);
    if (question.module === Resources.browserModule && request.action === Resources.browserNavigateAction && request.risk === ToolRisk.Low
      && offersAllowOnce)
      return PermissionDecision.AllowedOnce;
    const allowAlwaysLabel = remembersInChat ? null : PermissionAnswerer.labelOf(request, PermissionOption.AllowAlways);
    if (!remembersInChat && !offersAllowOnce && Object.isNull(allowAlwaysLabel))
      return PermissionDecision.Denied;
    const payload = new PermissionPayload(question.module, request.subject ?? null, PermissionAnswerer.RISKS.get(request.risk)!,
      request.details.map(t => PermissionAnswerer.detailOf(t)), this.calls.find(PermissionAnswerer.callIdOf(question)));
    const ask = new PermissionAsk(request.action, request.title, payload.toJson(), remembersInChat, allowAlwaysLabel,
      PermissionAnswerer.labelOf(request, PermissionOption.TakeOver), question.id, offersAllowOnce);
    return PermissionAnswerer.DECISIONS[await this.asker.askPermissionAsync(question.session, question.module, ask, signal)];
  }

  private static labelOf(request: IPermissionRequest, option: PermissionOption.AllowAlways | PermissionOption.TakeOver): string | null {
    const label = request.labels?.[option];
    return request.options.includes(option) && Object.isString(label) ? label : null;
  }

  private static callIdOf(question: PermissionQuestion): string | null {
    return "callId" in question && Object.isString(question.callId) ? question.callId : null;
  }

  private static remembersInChat(question: PermissionQuestion): boolean {
    return question.module === Resources.computerUseModule && Resources.computerUseChatActions.includes(question.request.action)
      && question.request.options.includes(PermissionOption.AllowAlways);
  }

  private static detailOf(detail: IPermissionDetail): PermissionDetail {
    const kind = PermissionAnswerer.KINDS.get(detail.kind)!;
    return new PermissionDetail(detail.label, kind, kind === PermissionDetailKind.Secret ? null : detail.value);
  }
}
