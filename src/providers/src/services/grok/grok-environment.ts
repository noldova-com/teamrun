/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { Resources } from "../../resources.js";
import type { GrokProfile } from "./grok-profile.js";

export class GrokEnvironment {
  public static build(base: NodeJS.ProcessEnv, profile: GrokProfile): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(base)) {
      if (!Resources.grokExcludedEnvironment.test(name))
        environment[name] = value;
    }
    environment[Resources.grokHomeVariable] = profile.directory;
    environment[Resources.homeVariable] = profile.homeDirectory;
    environment[Resources.userProfileVariable] = profile.homeDirectory;
    environment[Resources.appDataVariable] = join(profile.homeDirectory, Resources.grokRoamingDirectory);
    environment[Resources.localAppDataVariable] = join(profile.homeDirectory, Resources.grokLocalDirectory);
    environment[Resources.xdgConfigVariable] = join(profile.homeDirectory, Resources.grokXdgConfigDirectory);
    environment[Resources.xdgDataVariable] = join(profile.homeDirectory, Resources.grokXdgDataDirectory);
    for (const name of Resources.grokDisabledFeatures)
      environment[name] = Resources.grokDisabledValue;
    environment[Resources.grokFolderTrustVariable] = Resources.enabledValue;
    environment[Resources.grokPermissionVariable] = Resources.grokRejectPermission;
    return environment;
  }
}
