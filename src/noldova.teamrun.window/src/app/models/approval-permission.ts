/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import {
  type Approval,
  ApprovalKind,
  ApprovalOutcome,
  ApprovalScope,
  PermissionPayload,
  PermissionRisk as RequestRisk
} from "@noldova/teamrun.protocol";
import {
  type IPermissionRequestOptions,
  PermissionDecision,
  PermissionEffect,
  PermissionOption,
  PermissionRequest,
  PermissionRequester,
  PermissionRisk,
  PermissionScope
} from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import type { ApprovalAnswer } from "./approval-answer";

export class ApprovalPermission {
  private static readonly SCOPES: Readonly<Record<ApprovalScope, PermissionScope | null>> = {
    [ApprovalScope.Once]: PermissionScope.Once,
    [ApprovalScope.Session]: null,
    [ApprovalScope.Always]: PermissionScope.Always
  };
  private static readonly RISKS: Readonly<Record<RequestRisk, PermissionRisk>> = {
    [RequestRisk.Low]: PermissionRisk.Low,
    [RequestRisk.Medium]: PermissionRisk.Medium,
    [RequestRisk.High]: PermissionRisk.High
  };

  public static toRequest(approval: Approval, requesterName: string, answer: ApprovalAnswer | null, providerName: string | null = null): PermissionRequest {
    const requester = new PermissionRequester(requesterName, Resources.approvalRequesterKind);
    const options = approval.options.map(t =>
      new PermissionOption(t.id, t.label, t.outcome === ApprovalOutcome.Approved ? PermissionEffect.Allow : PermissionEffect.Deny, ApprovalPermission.SCOPES[t.scope]));
    if (approval.kind === ApprovalKind.Permission)
      return ApprovalPermission.permissionOf(approval, requester, options, answer);
    const subAgent = ApprovalPermission.subAgentOf(approval);
    return new PermissionRequest(approval.id, requester, Resources.approvalHeadings[approval.kind], null,
      { ...ApprovalPermission.kindOf(approval.kind, providerName), details: ApprovalPermission.withNativeKind([approval.summary], approval.nativeKind), ...Object.isNull(subAgent) ? {} : { description: Resources.formatSubAgentAsks(subAgent) }, options, ...ApprovalPermission.state(answer) });
  }

  public static subAgentOf(approval: Approval): string | null {
    const payload = approval.kind === ApprovalKind.Permission ? null : approval.payload;
    const name = ApprovalPermission.isJsonObject(payload) ? payload[Resources.subAgentField] : null;
    return Object.isString(name) && !String.isNullOrWhitespace(name) ? name : null;
  }

  private static permissionOf(approval: Approval, requester: PermissionRequester, options: readonly PermissionOption[],
    answer: ApprovalAnswer | null): PermissionRequest {
    const payload = PermissionPayload.fromJson(approval.payload);
    const details = payload.details.map(t => Resources.formatPermissionDetail(t.label, t.value));
    return new PermissionRequest(approval.id, requester, approval.summary, ApprovalPermission.RISKS[payload.risk], {
      ...details.length > 0 ? { details: details.join("\n") } : {},
      options,
      expiresAt: new Date(Date.parse(approval.createdAt) + Resources.permissionWaitMilliseconds),
      ...ApprovalPermission.state(answer)
    });
  }

  private static kindOf(kind: ApprovalKind, providerName: string | null): Pick<IPermissionRequestOptions, "kind"> {
    const name = Resources.approvalKindNames[kind];
    return Object.isNull(name) || Object.isNull(providerName) || String.isNullOrWhitespace(providerName) ? {}
      : { kind: Resources.formatApprovalKind(providerName, name) };
  }

  private static withNativeKind(lines: readonly string[], nativeKind: string): string {
    return [...lines, Resources.formatApprovalNativeKind(nativeKind)].join("\n");
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static state(answer: ApprovalAnswer | null): Pick<IPermissionRequestOptions, "status" | "decision"> {
    return Object.isNull(answer) ? {} : { status: answer.status, decision: new PermissionDecision(answer.optionId, Resources.approvalDecidedBy, answer.answeredAt) };
  }
}
