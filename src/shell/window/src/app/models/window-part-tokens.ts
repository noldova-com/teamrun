/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InjectionToken } from "@angular/core";

import type { IWindowPartContext } from "../interfaces/i-window-part-context";
import type { ContentPaddingRef } from "./content-padding-ref";
import type { MenuDeclarations } from "./menu-declarations";
import type { WindowPartSource } from "./window-part-source";
import { Resources } from "../../resources";

export class WindowPartTokens {
  public static readonly context: InjectionToken<IWindowPartContext> = new InjectionToken<IWindowPartContext>(Resources.windowPartContextToken);
  public static readonly sources: InjectionToken<readonly WindowPartSource[]> = new InjectionToken<readonly WindowPartSource[]>(
    Resources.windowPartSourcesToken,
    { providedIn: "root", factory: () => [] });
  public static readonly menus: InjectionToken<readonly MenuDeclarations[]> = new InjectionToken<readonly MenuDeclarations[]>(
    Resources.windowPartMenusToken,
    { providedIn: "root", factory: () => [] });
  public static readonly contentPadding: InjectionToken<ContentPaddingRef> = new InjectionToken<ContentPaddingRef>(Resources.contentPaddingToken);
}
