/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";

export class AppImageEnvironment {
  public static restore(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const folder = String(environment[Resources.appImageFolderVariable]);
    return Object.fromEntries(Object.entries(environment).flatMap(([name, value]): [string, string][] => {
      const restored = Object.isUndefined(value) || Resources.appImageVariables.includes(name) ? null : AppImageEnvironment.unwrap(name, value, folder);
      return Object.isNull(restored) ? [] : [[name, restored]];
    }));
  }

  private static unwrap(name: string, value: string, folder: string): string | null {
    const wrapping = Resources.appRunPathVariables.find(([variable]) => variable === name);
    if (Object.isUndefined(wrapping))
      return value;
    const [, prepended, appended] = wrapping;
    const entries = value.split(Resources.pathListSeparator);
    const isWrapped = prepended.every((t, i) => entries[i] === `${folder}${t}`) && appended.every((t, i) => entries.at(i - appended.length) === t);
    const kept = entries.slice(prepended.length, entries.length - appended.length);
    return !isWrapped ? value : kept.every(t => t.length === 0) ? null : kept.join(Resources.pathListSeparator);
  }
}
