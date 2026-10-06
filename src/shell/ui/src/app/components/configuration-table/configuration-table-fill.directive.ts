/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive } from "@angular/core";

@Directive({
  selector: "th[trConfigurationTableFill], td[trConfigurationTableFill]",
  host: {
    "class": "tr-configuration-table-fill"
  }
})
export class ConfigurationTableFillDirective {
}
