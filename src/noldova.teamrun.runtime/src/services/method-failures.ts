/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MethodFailureException, PermissionDecision, ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class MethodFailures {
  private static readonly UNANSWERED: ReadonlyMap<PermissionDecision, ToolFailure> = new Map([
    [PermissionDecision.Expired, new ToolFailure(ToolFailureCode.Expired, Resources.permissionExpired)],
    [PermissionDecision.Withdrawn, new ToolFailure(ToolFailureCode.Withdrawn, Resources.permissionWithdrawn)]
  ]);
  private static readonly DENIED: ToolFailure = new ToolFailure(ToolFailureCode.Denied, Resources.permissionDenied);

  public static of(moduleId: string, error: unknown): ToolFailure {
    if (error instanceof MethodFailureException)
      return new ToolFailure(ToolFailureCode.OutcomeUncertain, error.failure.message, Resources.formatQualifiedName(moduleId, error.failure.code));

    return new ToolFailure(ToolFailureCode.OutcomeUncertain, error instanceof Error ? error.message : String(error));
  }

  public static ofDecision(decision: PermissionDecision): ToolFailure {
    return MethodFailures.UNANSWERED.get(decision) ?? MethodFailures.DENIED;
  }
}
