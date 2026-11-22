/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { OrganizationTarget } from "@noldova/teamrun.protocol";

export class OrganizationTargetKey {
  public static of(target: OrganizationTarget): string {
    return `${target.kind}:${target.id ?? String.empty}`;
  }
}
