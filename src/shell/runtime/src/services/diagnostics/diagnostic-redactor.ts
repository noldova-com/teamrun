/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";

export class DiagnosticRedactor {
  private readonly homeFolder: RegExp;

  public constructor(homeFolder: string) {
    const parts = homeFolder.split(Resources.pathSeparatorPattern).map(t => t.replace(Resources.regularExpressionSyntaxPattern, Resources.escapedMatch));
    this.homeFolder = new RegExp(parts.join(Resources.pathSeparatorSource), Resources.caseInsensitiveGlobalFlags);
  }

  public redact(text: string): string {
    return text.replace(this.homeFolder, Resources.homeAbbreviation).replace(Resources.opaqueValuePattern, Resources.redactedValue);
  }
}
