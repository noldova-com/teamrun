/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { AcpEnvironment } from "../acp/acp-environment.js";

export class GrokEnvironment {
  public static build(base: NodeJS.ProcessEnv, home: string, added: boolean, background: boolean, titleSignIn: string | null = null): NodeJS.ProcessEnv {
    const environment = AcpEnvironment.copy(base, Resources.grokExcludedEnvironment);
    if (added) {
      for (const name of Object.keys(environment).filter(t => Resources.grokProfileExcludedEnvironment.test(t)))
        delete environment[name];
    }
    environment[Resources.grokHomeVariable] = home;
    if (background) {
      for (const name of Resources.grokBackgroundOffVariables)
        environment[name] = Resources.grokDisabledValue;
    }
    if (!Object.isNull(titleSignIn)) {
      for (const name of Resources.grokTitleDroppedVariables)
        delete environment[name];
      for (const name of Resources.grokTitleOffVariables)
        environment[name] = Resources.grokDisabledValue;
      environment[Resources.grokAuthPathVariable] = titleSignIn;
    }
    environment[Resources.grokFolderTrustVariable] = Resources.enabledValue;
    return environment;
  }
}
