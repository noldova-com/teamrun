/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OrganizationSend {
  public readonly flowId: string;
  public readonly teammateId: string;
  public readonly toChatId: string;

  public constructor(flowId: string, teammateId: string, toChatId: string) {
    this.flowId = flowId;
    this.teammateId = teammateId;
    this.toChatId = toChatId;
  }
}
