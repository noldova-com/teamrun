/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import type { IMethodHandler, IModuleSecrets, RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InProcessCliContext, RuntimePartException } from "@noldova/teamrun.runtime";

@TestClass
export class InProcessCliContextTests {
  private static secretsOf(saved: Map<string, string>): IModuleSecrets {
    return {
      saveAsync: (name, value) => { saved.set(name, value); return Promise.resolve(); },
      readAsync: () => Promise.reject(new Error("The command line never reads a secret back.")),
      removeAsync: name => { saved.delete(name); return Promise.resolve(); },
      isSetAsync: name => Promise.resolve(saved.has(name))
    };
  }

  @TestMethod
  public async keepsTheCommandsAndRunsTheirRequestsThroughTheRuntimePartsMethods(): Promise<void> {
    const requests: RequestContext[] = [];
    const handler: IMethodHandler = { handleAsync: context => { requests.push(context); return Promise.resolve(["p1"]); } };
    const context = new InProcessCliContext("teamrun", new Map([["teamrun.projectList", handler]]), InProcessCliContextTests.secretsOf(new Map()));
    const command = { handleAsync: () => Promise.resolve(new CliCommandResult(null, "(none)")) };
    const signal = new AbortController().signal;

    context.registerCommand("teamrun.listProjects", command);
    const answer = await context.requestAsync("teamrun.projectList", { all: true }, signal);

    Assert.areEqual("teamrun", context.moduleId);
    Assert.areEqual(command, context.commands.get("teamrun.listProjects"));
    Assert.areEqual(JSON.stringify(["p1"]), JSON.stringify(answer));
    Assert.areEqual(JSON.stringify([["teamrun.tools", { all: true }, 0]]), JSON.stringify(requests.map(t => [t.client, t.payload, t.connection])));
    Assert.areEqual(signal, requests[0]!.signal);
  }

  @TestMethod
  public async refusesAMethodThePartDoesNotRegister(): Promise<void> {
    const context = new InProcessCliContext("teamrun", new Map(), InProcessCliContextTests.secretsOf(new Map()));

    const refused = await Assert.throwsAsync(() => context.requestAsync("teamrun.missing", null, new AbortController().signal), RuntimePartException);

    Assert.areEqual("TeamRun's tools reached for the method teamrun.missing, which the runtime part doesn't register.", refused.message);
  }

  @TestMethod
  public async savesRemovesAndChecksTheCommandsSecretsInTheRuntimePartsOwn(): Promise<void> {
    const saved = new Map<string, string>();
    const context = new InProcessCliContext("teamrun", new Map(), InProcessCliContextTests.secretsOf(saved));
    const signal = new AbortController().signal;

    await context.secrets.saveAsync("teamrun.token", "t1", signal);
    const isSaved = await context.secrets.isSetAsync("teamrun.token", signal);
    await context.secrets.removeAsync("teamrun.token", signal);

    Assert.isTrue(isSaved);
    Assert.isFalse(await context.secrets.isSetAsync("teamrun.token", signal));
    Assert.areEqual(0, saved.size);
    Assert.isFalse("readAsync" in context.secrets);
  }

  @TestMethod
  public async refusesEachSecretCallOfACommandWhoseSignalIsAborted(): Promise<void> {
    const saved = new Map([["teamrun.token", "t1"]]);
    const context = new InProcessCliContext("teamrun", new Map(), InProcessCliContextTests.secretsOf(saved));
    const aborted = AbortSignal.abort();

    await Assert.throwsAsync(() => context.secrets.saveAsync("teamrun.other", "t2", aborted), Error);
    await Assert.throwsAsync(() => context.secrets.removeAsync("teamrun.token", aborted), Error);
    await Assert.throwsAsync(() => context.secrets.isSetAsync("teamrun.token", aborted), Error);

    Assert.areEqual(JSON.stringify([["teamrun.token", "t1"]]), JSON.stringify([...saved]));
  }
}
