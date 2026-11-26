/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpClient, CurrentAcpClient, InvalidOperationException, NodeProcessStarter, ProcessCommand, ProviderTimings, Resources } from "@noldova/teamrun.providers";

@TestClass
export class CurrentAcpClientTests {
  @TestMethod
  public refusesAReadBeforeAClientIsSetAndThenGivesTheLatest(): void {
    const current = new CurrentAcpClient();
    const first = CurrentAcpClientTests.clientOf();
    const relaunched = CurrentAcpClientTests.clientOf();

    Assert.areEqual(Resources.acpClientNotStarted, Assert.throws(() => current.client, InvalidOperationException).message);
    Assert.isTrue(current.set(first) === first);
    Assert.isTrue(current.client === first);
    current.set(relaunched);
    Assert.isTrue(current.client === relaunched);
  }

  private static clientOf(): AcpClient {
    return new AcpClient(new ProcessCommand(process.execPath, []), {}, process.cwd(), new NodeProcessStarter(), new ProviderTimings(5000, 5000, 5000, 5000, 1000, 300, 500, 500, 200, 1, 20));
  }
}
