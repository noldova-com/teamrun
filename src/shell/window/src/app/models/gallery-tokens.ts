/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InjectionToken, type Type } from "@angular/core";

import { Resources } from "../../resources";

export class GalleryTokens {
  public static readonly component: InjectionToken<Type<unknown> | null> = new InjectionToken<Type<unknown> | null>(
    Resources.galleryComponentToken,
    { providedIn: "root", factory: () => null });
}
