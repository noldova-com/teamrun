/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { ApprovalQuestion, type QuestionAnswer, QuestionOption } from "@noldova/teamrun.protocol";

import type { IAcpQuestionReader } from "../../interfaces/i-acp-question.reader.js";
import { Resources } from "../../resources.js";

export class AntigravityQuestionReader implements IAcpQuestionReader {
  public readonly methods: readonly string[] = [Resources.acpRequestPermission];
  public readonly nativeKind: string = Resources.acpRequestPermission;

  public claims(params: JsonReader): boolean {
    try {
      const tool = params.readObject(Resources.acpToolCallField);
      const options = params.readObjectArray(Resources.optionsField);

      return (tool.readOptionalString(Resources.acpToolCallIdField) ?? String.empty).startsWith(Resources.antigravityQuestionIdPrefix)
        && Object.isUndefined(tool.readOptionalString(Resources.kindField)) && options.length > 0
        && options.every(t => t.readOptionalString(Resources.kindField) === Resources.acpAllowOnce) && !Object.isNull(this.read(params));
    }
    catch {
      return false;
    }
  }

  public read(params: JsonReader): readonly ApprovalQuestion[] | null {
    try {
      const tool = params.readObject(Resources.acpToolCallField);
      return [new ApprovalQuestion(tool.readNonBlankString(Resources.acpToolCallIdField), String.empty, tool.readNonBlankString(Resources.titleField),
        params.readObjectArray(Resources.optionsField).map(t => {
          t.readNonBlankString(Resources.acpOptionIdField);
          return new QuestionOption(t.readNonBlankString(Resources.nameField), String.empty);
        }), false, false, false)];
    }
    catch {
      return null;
    }
  }

  public reply(params: JsonReader, answers: readonly QuestionAnswer[] | null): JsonObject {
    const choice = answers?.[0]?.choices[0];
    const option = Object.isNullOrUndefined(choice) ? undefined : params.readObjectArray(Resources.optionsField).find(t => t.readOptionalString(Resources.nameField) === choice);

    return Object.isUndefined(option) ? { outcome: { outcome: Resources.acpCancelled } }
      : { outcome: { outcome: Resources.acpSelected, optionId: option.readNonBlankString(Resources.acpOptionIdField) } };
  }
}
