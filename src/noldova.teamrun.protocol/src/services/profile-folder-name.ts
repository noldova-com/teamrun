/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class ProfileFolderName {
  public static of(label: string): string | null {
    const kept = label.replace(Resources.profileFolderUnsafePattern, Resources.profileFolderReplacement)
      .replace(Resources.profileFolderEdgePattern, String.empty);
    const name = [...kept].slice(0, Resources.profileFolderNameLimit).join(String.empty).replace(Resources.profileFolderEdgePattern, String.empty);
    if (name.length === 0)
      return null;

    return Resources.reservedFolderNamePattern.test(name) ? `${Resources.profileFolderReservedPrefix}${name}` : name;
  }
}
