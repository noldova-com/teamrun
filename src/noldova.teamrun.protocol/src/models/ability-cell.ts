/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { AbilityAnswer } from "../enums/ability-answer.js";
import { AbilitySource } from "../enums/ability-source.js";
import { Resources } from "../resources.js";

export class AbilityCell {
  private static readonly sources: Readonly<Record<AbilitySource, string>> = {
    [AbilitySource.Acp]: Resources.abilityAcpSource, [AbilitySource.AcpAddition]: Resources.abilityAcpAdditionSource,
    [AbilitySource.Outside]: Resources.abilityOutsideSource
  };
  private static readonly notes: Readonly<Record<AbilitySource, string>> = {
    [AbilitySource.Acp]: Resources.abilityAcpNote, [AbilitySource.AcpAddition]: Resources.abilityAcpAdditionNote, [AbilitySource.Outside]: Resources.abilityOutsideNote
  };

  public readonly answer: AbilityAnswer;
  public readonly source: AbilitySource | null;
  public readonly detail: string | null;

  public constructor(answer: AbilityAnswer, source: AbilitySource | null, detail: string | null = null) {
    if (!Object.values(AbilityAnswer).includes(answer))
      throw new ArgumentException(Resources.invalidAbilityAnswer, Resources.answerField);
    if (!Object.isNull(source) && !Object.values(AbilitySource).includes(source))
      throw new ArgumentException(Resources.invalidAbilitySource, Resources.sourceField);
    if ((answer === AbilityAnswer.Works) === Object.isNull(source))
      throw new ArgumentException(Resources.abilitySourceOnlyWhenWorks, Resources.sourceField);
    if (Object.isNull(detail) ? answer !== AbilityAnswer.Works : detail.trim().length === 0)
      throw new ArgumentException(Resources.abilityDetailRequired, Resources.detailField);

    this.answer = answer;
    this.source = source;
    this.detail = detail;
  }

  public static works(source: AbilitySource, detail: string | null = null): AbilityCell {
    return new AbilityCell(AbilityAnswer.Works, source, detail);
  }

  public static cannot(reason: string): AbilityCell {
    return new AbilityCell(AbilityAnswer.Cannot, null, reason);
  }

  public static notBuilt(reason: string): AbilityCell {
    return new AbilityCell(AbilityAnswer.NotBuilt, null, reason);
  }

  public static notChecked(reason: string): AbilityCell {
    return new AbilityCell(AbilityAnswer.NotChecked, null, reason);
  }

  public get answerLabel(): string {
    return this.answer === AbilityAnswer.Works ? Resources.abilityWorksLabel : this.answer === AbilityAnswer.Cannot ? Resources.abilityCannotLabel
      : this.answer === AbilityAnswer.NotBuilt ? Resources.abilityNotBuiltLabel : Resources.abilityNotCheckedLabel;
  }

  public get sourceNote(): string | null {
    return Object.isNull(this.source) ? null : AbilityCell.notes[this.source];
  }

  public get reasonAlone(): string | null {
    if (Object.isNull(this.detail) || !this.detail.startsWith(Resources.abilityNotBuiltLead))
      return this.detail;
    const rest = this.detail.slice(Resources.abilityNotBuiltLead.length).trimStart();
    const reason = (Resources.abilityLeadJoins.includes(rest.charAt(0)) ? rest.slice(1) : rest).trim();
    return reason.length === 0 ? null : reason;
  }

  public get label(): string {
    return Object.isNull(this.source) ? this.answerLabel : Resources.formatAbilityWorks(AbilityCell.sources[this.source]);
  }

  public reasonFor(displayName: string): string | null {
    const reason = this.reasonAlone;
    if (Object.isNull(reason))
      return null;
    if (reason.startsWith(Resources.abilityItsSubject))
      return `${Resources.formatAbilityOwner(displayName)}${reason.slice(Resources.abilityItsSubject.length)}`;
    return reason.startsWith(Resources.abilityItSubject) ? `${Resources.formatAbilitySubject(displayName)}${reason.slice(Resources.abilityItSubject.length)}` : reason;
  }

  public reasonAgainst(): string | null {
    return this.answer === AbilityAnswer.Cannot || this.answer === AbilityAnswer.NotBuilt ? this.detail : null;
  }

  public static fromJson(value: unknown, path?: string): AbilityCell {
    const reader = JsonReader.fromValue(value, path);
    return new AbilityCell(reader.readOneOf(Resources.answerField, Object.values(AbilityAnswer)),
      reader.readNullableString(Resources.sourceField) as AbilitySource | null, reader.readNullableString(Resources.detailField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.answerField]: this.answer,
      [Resources.sourceField]: this.source,
      [Resources.detailField]: this.detail
    };
  }
}
