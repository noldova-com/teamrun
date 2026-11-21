/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageIdParams, OrganizationMessage, OrganizationMessageSendParams } from "@noldova/teamrun.protocol";

export interface IOrganizationMessagesService {
  listAsync(): Promise<readonly OrganizationMessage[]>;
  sendAsync(params: OrganizationMessageSendParams): Promise<OrganizationMessage>;
  stopAsync(params: MessageIdParams): Promise<OrganizationMessage>;
}
