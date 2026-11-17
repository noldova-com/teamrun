/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";
import type { ApprovalQuestion, QuestionAnswer } from "@noldova/teamrun.protocol";

export interface IAcpQuestionReader {
  readonly methods: readonly string[];
  readonly nativeKind: string;
  claims(params: JsonReader): boolean;
  read(params: JsonReader): readonly ApprovalQuestion[] | null;
  reply(params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject;
}
