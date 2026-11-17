/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { ApprovalQuestion } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class QuestionAsk {
  public readonly providerRequestId: string;
  public readonly nativeKind: string;
  public readonly questions: readonly ApprovalQuestion[];
  public readonly subAgent: string | null;

  public constructor(providerRequestId: string, nativeKind: string, questions: readonly ApprovalQuestion[], subAgent: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(providerRequestId, Resources.providerRequestIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(nativeKind, Resources.nativeKindParameterName);
    ArgumentException.throwIfEmpty(questions, Resources.questionsParameterName);

    this.providerRequestId = providerRequestId;
    this.nativeKind = nativeKind;
    this.questions = [...questions];
    this.subAgent = subAgent;
  }
}
