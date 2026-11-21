/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OrganizationRecipientRow {
  public readonly teammateId: string;
  public readonly name: string;
  public readonly status: string;

  public constructor(teammateId: string, name: string, status: string) {
    this.teammateId = teammateId;
    this.name = name;
    this.status = status;
  }
}
