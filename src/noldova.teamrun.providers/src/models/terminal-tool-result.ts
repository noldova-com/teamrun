/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export class TerminalToolResult {
  public readonly report: JsonObject | null;
  public readonly text: string;
  public readonly isError: boolean;

  public constructor(report: JsonObject | null, text: string, isError: boolean) {
    this.report = report;
    this.text = text;
    this.isError = isError;
  }
}
