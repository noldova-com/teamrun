/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MethodName } from "@noldova/teamrun-protocol";
import { CliSettings, LauncherConnectionFactoryBuilder, OutputFormat } from "@noldova/teamrun-cli";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class LauncherConnectionFactoryTests {
  @TestMethod
  public async startsARuntimeAndConnects(): Promise<void> {
    using directory = new TemporaryDirectory();
    const settings = new CliSettings(directory.resolve("data"), OutputFormat.Text, 300, "none", "0.0.1-test");
    const factory = new LauncherConnectionFactoryBuilder(process.platform, process.execPath).build(settings);

    const before = factory.readLiveLock();
    const client = await factory.connect({ onEvent: () => undefined, onDisconnected: () => undefined });
    const providers = await client.call(MethodName.ProviderList, null);
    const during = factory.readLiveLock();
    client.close();
    await Wait.until(() => factory.readLiveLock() === null);

    Assert.isNull(before);
    Assert.areEqual("[]", JSON.stringify(providers.payload));
    Assert.areEqual("0.0.1-test", during?.productVersion);
  }
}
