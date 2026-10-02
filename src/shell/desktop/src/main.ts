/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DesktopSettings } from "./models/desktop-settings.js";
import { DesktopApplication } from "./services/desktop-application.js";
import { SenderPolicy } from "./services/sender-policy.js";
import { WindowFactory } from "./services/window-factory.js";

const settings = DesktopSettings.fromModule(dirname(fileURLToPath(import.meta.url)), process.platform);
const policy = new SenderPolicy(settings.windowUrl);
new DesktopApplication(settings, policy, new WindowFactory(settings, policy)).run();
