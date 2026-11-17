/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class UsualFolder {
  public static of(environment: NodeJS.ProcessEnv, variable: string | null, name: string, home: string = homedir()): string {
    const named = Object.isNull(variable) ? undefined : environment[variable];
    return Object.isUndefined(named) || String.isNullOrWhitespace(named) ? join(home, name) : named;
  }

  public static home(environment: NodeJS.ProcessEnv, platform: string = process.platform): string {
    const named = environment[platform === Resources.windowsPlatform ? Resources.userProfileVariable : Resources.homeVariable];
    return Object.isUndefined(named) || String.isNullOrWhitespace(named) ? homedir() : named;
  }

  public static places(environment: NodeJS.ProcessEnv, variable: string, name: string, home: string = homedir()): readonly string[] {
    const usual = join(home, name);
    const place = UsualFolder.place(environment, variable, name, home);
    return place === usual ? [usual] : [usual, place];
  }

  public static place(environment: NodeJS.ProcessEnv, variable: string, name: string, home: string = homedir()): string {
    const named = environment[variable];
    return Object.isUndefined(named) || !isAbsolute(named) ? join(home, name) : named;
  }
}
