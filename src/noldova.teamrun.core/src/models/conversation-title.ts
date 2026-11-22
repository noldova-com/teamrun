/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { TextCut } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class ConversationTitle {
  public readonly text: string;

  public constructor(message: string) {
    const found = message.split(Resources.lineSeparator).find(t => !String.isNullOrWhitespace(t));
    if (Object.isUndefined(found))
      throw new ArgumentException(Resources.titleNeedsText, Resources.messageParameterName);
    const line = found.trim();
    this.text = [...line].length <= Resources.maximumTitleLength ? line
      : `${TextCut.toPoints(line, Resources.maximumTitleLength - 1).trimEnd()}${Resources.ellipsis}`;
  }

  public static ofAnswer(answer: string): string | null {
    const line = answer.split(Resources.lineSeparator).find(t => !String.isNullOrWhitespace(t));
    if (Object.isUndefined(line))
      return null;
    const bare = line.replace(Resources.titleLabelPattern, String.empty).replace(Resources.titleWrappingPattern, String.empty)
      .replace(Resources.whitespacePattern, Resources.space);
    return String.isNullOrWhitespace(bare) ? null : new ConversationTitle(bare).text;
  }
}
