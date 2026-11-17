/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StepCategory } from "../enums/step-category";

export class ActivityStep {
  public readonly sequence: number;
  public readonly title: string;
  public readonly category: StepCategory;
  public readonly glyph: string;
  public readonly body: string | null;
  public readonly isFailed: boolean;
  public readonly isDenied: boolean;

  public constructor(sequence: number, title: string, category: StepCategory, glyph: string, body: string | null, isFailed: boolean,
    isDenied: boolean) {
    this.sequence = sequence;
    this.title = title;
    this.category = category;
    this.glyph = glyph;
    this.body = body;
    this.isFailed = isFailed;
    this.isDenied = isDenied;
  }

  public get isThought(): boolean {
    return this.category === StepCategory.Thought;
  }

  public get isCommand(): boolean {
    return this.category === StepCategory.Command;
  }
}
