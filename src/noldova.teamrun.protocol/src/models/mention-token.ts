/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class MentionToken {
  public readonly teammateId: string;
  public readonly label: string;
  public readonly start: number;
  public readonly end: number;

  public constructor(teammateId: string, label: string, start: number, end: number) {
    this.teammateId = teammateId;
    this.label = label;
    this.start = start;
    this.end = end;
  }

  public static format(teammateId: string, label: string): string {
    const text = `${Resources.mentionTokenOpen}${label}${Resources.mentionTokenMiddle}${teammateId}${Resources.mentionTokenClose}`;
    if (MentionToken.at(text, 0)?.end !== text.length)
      throw new ArgumentException(Resources.invalidMentionToken, Resources.labelField);
    return text;
  }

  public static at(text: string, start: number): MentionToken | null {
    const pattern = new RegExp(Resources.mentionTokenPattern.source, Resources.mentionTokenPattern.flags);
    pattern.lastIndex = start;
    const match = pattern.exec(text);
    return Object.isNull(match) ? null : new MentionToken(match[2]!, match[1]!, start, start + match[0].length);
  }
}
