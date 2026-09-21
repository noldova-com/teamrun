/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Teammate, TeammateCreateParams, TeammateUpdateParams, TeammateIdParams } from "@noldova/teamrun-protocol";

export interface ITeammatesService {
  list(): readonly Teammate[];
  find(teammateId: string): Teammate | null;
  create(params: TeammateCreateParams): Teammate;
  update(params: TeammateUpdateParams): Teammate;
  delete(params: TeammateIdParams): void;
}
