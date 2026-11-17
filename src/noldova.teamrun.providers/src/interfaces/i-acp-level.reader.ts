/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider } from "@noldova/teamrun.protocol";

import type { AcpLaunch } from "../models/acp-launch.js";

export interface IAcpLevelReader {
  launch(provider: Provider | null, environment: NodeJS.ProcessEnv): AcpLaunch;
  read(output: string): ReadonlyMap<string, readonly string[]>;
}
