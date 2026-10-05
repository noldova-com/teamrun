/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class WorkMethodTests {
  @TestMethod
  public listsTheWorkInProgressWithoutStopping(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      connection.sendMessages(new Request("cli:1", ShellMethods.work, null));
      const idle = await connection.readTextAsync();
      const work = host.work.begin("Indexing the project");
      const began = await connection.readTextAsync();
      connection.sendMessages(new Request("cli:2", ShellMethods.work, null));
      const busy = await connection.readTextAsync();
      work[Symbol.dispose]();
      const ended = await connection.readTextAsync();
      connection.sendMessages(new Request("cli:3", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson()));

      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"cli:1\",\"payload\":{\"descriptions\":[],\"sequence\":0}}", idle);
      Assert.areEqual("{\"kind\":\"Event\",\"name\":\"shell.work\",\"payload\":{\"descriptions\":[\"Indexing the project\"],\"sequence\":1}}", began);
      Assert.areEqual("{\"kind\":\"Response\",\"id\":\"cli:2\",\"payload\":{\"descriptions\":[\"Indexing the project\"],\"sequence\":1}}", busy);
      Assert.areEqual("{\"kind\":\"Event\",\"name\":\"shell.work\",\"payload\":{\"descriptions\":[],\"sequence\":2}}", ended);
      Assert.isFalse(work.signal.aborted);
      Assert.areEqual("request", await host.waitForStopAsync());
    });
  }
}
