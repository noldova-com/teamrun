/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider } from "@angular/core";

import { ViewDialogService } from "../../src/app/services/view-dialog.service";

export class ViewDialogFixture {
  public static provideShowing(module: string | null): Provider {
    return { provide: ViewDialogService, useValue: { ownsCommand: (name: string) => !Object.isNull(module) && name.startsWith(`${module}.`) } };
  }
}
