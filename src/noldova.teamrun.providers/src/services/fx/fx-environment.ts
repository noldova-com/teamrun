/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { AcpEnvironment } from "../acp/acp-environment.js";

export class FxEnvironment {
  public static build(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const environment = AcpEnvironment.copy(base, Resources.fxExcludedEnvironment);
    environment[Resources.fxNoColorVariable] = Resources.enabledValue;
    return environment;
  }
}
