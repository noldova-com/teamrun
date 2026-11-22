/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TeamRunApp } from "../fixtures/teamrun-app.fixture.ts";

export interface ITeamRunFixtures {
  app: TeamRunApp;
  isAppTraced: boolean;
}
