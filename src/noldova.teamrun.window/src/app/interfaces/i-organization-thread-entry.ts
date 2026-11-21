/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OrganizationMessage } from "@noldova/teamrun.protocol";
import type { MessageBlock } from "@noldova/ui.components.angular";

import type { IOrganizationReplyEntry } from "./i-organization-reply-entry";

export interface IOrganizationThreadEntry {
  readonly message: OrganizationMessage;
  readonly blocks: readonly MessageBlock[];
  readonly lines: readonly string[];
  readonly failures: readonly string[];
  readonly stoppable: boolean;
  readonly replies: readonly IOrganizationReplyEntry[];
}
