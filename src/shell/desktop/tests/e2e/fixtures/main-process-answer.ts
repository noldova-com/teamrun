/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface MainProcessAnswerRecord {
  readonly action: string;
  readonly at: number;
}

export default class MainProcessAnswer {
  public static describeLast(last: MainProcessAnswerRecord | null, asked: number): string {
    if (last === null)
      return "It had answered none of the harness's own calls before; the workflow's own calls are not counted.";
    const gap = last.at <= asked ? `${asked - last.at} ms before` : `${last.at - asked} ms after`;
    return `The last of the harness's own calls it answered was to ${last.action}, ${gap} this one was asked; the workflow's own calls are not counted.`;
  }
}
