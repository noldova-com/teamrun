/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ProviderKindInstallation } from "@noldova/teamrun.protocol";

export class ProviderInstallLine {
  public readonly installation: ProviderKindInstallation;
  public readonly name: string;
  public readonly text: string;

  public constructor(installation: ProviderKindInstallation, name: string, text: string) {
    this.installation = installation;
    this.name = name;
    this.text = text;
  }
}
