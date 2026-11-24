/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider } from "@angular/core";
import { kitTestProviders } from "@noldova/ui.components.angular/testing";

export default [...kitTestProviders] satisfies Provider[];
