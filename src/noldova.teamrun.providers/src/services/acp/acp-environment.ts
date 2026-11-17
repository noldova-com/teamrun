/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";

export class AcpEnvironment {
  public static copy(base: NodeJS.ProcessEnv, excluded: RegExp): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(base)) {
      if (!excluded.test(name))
        environment[name] = value;
    }
    return environment;
  }

  public static forSignIn(environment: NodeJS.ProcessEnv, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const isPersons = (name: string): boolean => Resources.signInVariables.includes(name.toUpperCase());
    return Object.fromEntries([...Object.entries(environment).filter(([name]) => !isPersons(name)),
      ...Object.entries(base).filter(([name]) => isPersons(name))]);
  }
}
