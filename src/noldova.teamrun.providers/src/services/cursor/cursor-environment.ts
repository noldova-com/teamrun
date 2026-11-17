/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { AcpEnvironment } from "../acp/acp-environment.js";
import type { CursorProfile } from "./cursor-profile.js";

export class CursorEnvironment {
  public static build(base: NodeJS.ProcessEnv, profile: CursorProfile, titleSession: boolean = false): NodeJS.ProcessEnv {
    const environment = AcpEnvironment.copy(base, Resources.cursorExcludedEnvironment);
    environment[Resources.cursorConfigVariable] = profile.directory;
    for (const [name, folder] of Object.entries(titleSession ? { ...profile.folders, ...profile.titleHomes } : profile.folders))
      environment[name] = folder;
    environment[Resources.cursorNoBrowserVariable] = Resources.enabledValue;
    environment[Resources.cursorNoColorVariable] = Resources.enabledValue;
    return environment;
  }
}
