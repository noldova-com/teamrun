/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ProviderWizardRow } from "./provider-wizard-row";

export class ProviderKindCard {
  public readonly id: string;
  public readonly name: string;
  public readonly note: string;
  public readonly isWarning: boolean;
  public readonly row: ProviderWizardRow | null;
  public readonly takenReason: string | null;

  public constructor(id: string, name: string, note: string, isWarning: boolean, row: ProviderWizardRow | null, takenReason: string | null = null) {
    this.id = id;
    this.name = name;
    this.note = note;
    this.isWarning = isWarning;
    this.row = row;
    this.takenReason = takenReason;
  }
}
