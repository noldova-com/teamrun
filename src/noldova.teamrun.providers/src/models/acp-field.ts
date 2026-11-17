/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader, JsonValue } from "@noldova/context.json";
import { ApprovalQuestion, type QuestionAnswer, QuestionOption } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class AcpField {
  public readonly type: string;
  public readonly values: readonly string[];
  public readonly question: ApprovalQuestion;

  public constructor(type: string, values: readonly string[], question: ApprovalQuestion) {
    this.type = type;
    this.values = [...values];
    this.question = question;
  }

  public static read(name: string, field: JsonReader, message: string): AcpField {
    const type = field.readNonBlankString(Resources.typeField);
    const choices = AcpField.readChoices(type === Resources.acpArrayType ? field.readObject(Resources.acpItemsField) : field);
    const options = type === Resources.acpBooleanType ? [Resources.yesLabel, Resources.noLabel].map(t => new QuestionOption(t, String.empty)) : choices.map(t => t[1]);

    return new AcpField(type, choices.map(t => t[0]), new ApprovalQuestion(name, field.readOptionalString(Resources.titleField) ?? name,
      field.readOptionalString(Resources.descriptionField) ?? message, options, type === Resources.acpArrayType, options.length === 0, false));
  }

  public toValue(answer: QuestionAnswer): JsonValue | undefined {
    const picked = answer.choices.map(t => this.values[this.question.options.findIndex(u => u.label === t)] ?? t);
    if (this.type === Resources.acpBooleanType)
      return answer.choices[0] === Resources.yesLabel;
    if (this.type === Resources.acpArrayType)
      return picked;
    if (this.type !== Resources.acpNumberType && this.type !== Resources.acpIntegerType)
      return picked[0] ?? answer.text;
    const number = Number(answer.text);

    return Number.isFinite(number) && (this.type === Resources.acpNumberType || Number.isInteger(number)) ? number : undefined;
  }

  private static readChoices(field: JsonReader): readonly (readonly [string, QuestionOption])[] {
    if (field.hasField(Resources.acpEnumField))
      return field.readStringArray(Resources.acpEnumField).map(t => [t, new QuestionOption(t, String.empty)]);
    const key = [Resources.acpOneOfField, Resources.acpAnyOfField].find(t => field.hasField(t));
    if (Object.isUndefined(key))
      return [];

    return field.readObjectArray(key).map(t => [t.readString(Resources.acpConstField), new QuestionOption(t.readOptionalString(Resources.titleField)
      ?? t.readString(Resources.acpConstField), t.readOptionalString(Resources.descriptionField) ?? String.empty)]);
  }
}
