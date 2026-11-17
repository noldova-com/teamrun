/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class ProfileFolderPath {
  public static isSame(first: string, second: string): boolean {
    return ProfileFolderPath.keyOf(first) === ProfileFolderPath.keyOf(second);
  }

  private static keyOf(path: string): string {
    const trimmed = path.trim().replace(Resources.trailingFolderSeparatorPattern, String.empty);
    return Resources.windowsPathPattern.test(trimmed) ? trimmed.replaceAll(Resources.slash, Resources.backslash).toLowerCase() : trimmed;
  }
}
