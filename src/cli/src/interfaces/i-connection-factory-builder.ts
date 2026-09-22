/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CliSettings } from "../models/cli-settings.js";
import type { IConnectionFactory } from "./i-connection-factory.js";

export interface IConnectionFactoryBuilder {
  build(settings: CliSettings): IConnectionFactory;
}
