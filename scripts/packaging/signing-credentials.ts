/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import MacSigning from "./mac-signing.ts";
import WindowsSigning from "./windows-signing.ts";

export default class SigningCredentials {
  public static readonly NAMES: readonly string[] = [...WindowsSigning.CREDENTIALS, ...MacSigning.CREDENTIALS];

  public static take(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const credentials = Object.fromEntries(SigningCredentials.NAMES.filter(t => environment[t] !== undefined).map(t => [t, environment[t]]));
    for (const name of SigningCredentials.NAMES)
      Reflect.deleteProperty(environment, name);
    return credentials;
  }
}
