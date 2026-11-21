/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Teammate } from "@noldova/teamrun.protocol";

import type { OrganizationConversation } from "../models/organization-conversation";

export interface IOrganizationConversationRow {
  readonly conversation: OrganizationConversation;
  readonly title: string;
  readonly teammate: Teammate | null;
  readonly icon: string;
  readonly time: string;
  readonly lastLine: string;
  readonly unread: number;
}
