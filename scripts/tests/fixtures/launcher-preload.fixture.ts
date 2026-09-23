/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mock } from "node:test";

import BuildEvidence from "../../build/build-evidence.ts";
import DevelopmentBinaryFixture from "./development-binary.fixture.ts";
import LauncherProcessFixture from "./launcher-process.fixture.ts";

mock.method(BuildEvidence, "requireCurrent", async (): Promise<void> => {});
mock.module("../../desktop/development-binary.ts", { exports: { default: DevelopmentBinaryFixture } });
mock.module("node:child_process", { exports: { spawn: LauncherProcessFixture.spawn } });
