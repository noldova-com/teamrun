/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { AcpEnvironment } from "../acp/acp-environment.js";
import type { AntigravityProfile } from "./antigravity-profile.js";

export class AntigravityEnvironment {
  public static build(platform: string, base: NodeJS.ProcessEnv, profile: AntigravityProfile, home: string, harnessPath: string): NodeJS.ProcessEnv {
    const environment = AcpEnvironment.copy(base, Resources.antigravityExcludedEnvironment);
    environment[Resources.antigravityHomeVariable] = home;
    environment[Resources.antigravityFileStorageVariable] = Resources.enabledValue;
    environment[Resources.antigravityHarnessVariable] = harnessPath;
    environment[Resources.pythonUnbufferedVariable] = Resources.enabledValue;
    for (const name of platform === Resources.windowsPlatform ? Resources.windowsTempVariables : Resources.posixTempVariables)
      environment[name] = profile.tempDirectory;
    return environment;
  }
}
