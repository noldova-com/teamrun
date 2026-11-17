/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, Provider } from "@noldova/teamrun.protocol";
import { GrokHome } from "@noldova/teamrun.providers";

@TestClass
export class GrokHomeTests {
  @TestMethod
  public runsAProviderWithoutAFolderOrInTheFormerProfileInThePersonsGrokHomeAndAnAddedOneInItsOwn(): void {
    const provider = (folder: string): Provider => new Provider("a", "grok", "Work", folder, AuthStatus.Unknown, null, null, null, null, "t");
    const former = join("/data", "profiles", "grok", "default");
    const home = new GrokHome({ HOME: "/home/person", USERPROFILE: "/home/person" }, former);
    const named = new GrokHome({ GROK_HOME: "/elsewhere/grok", HOME: "/home/person", USERPROFILE: "/home/person" }, former);
    const blank = new GrokHome({ GROK_HOME: " " }, former, "/home/given");

    Assert.areEqual(JSON.stringify([join("/home/person", ".grok"), "/elsewhere/grok", join("/home/given", ".grok")]),
      JSON.stringify([home.directory, named.directory, blank.directory]));
    Assert.areEqual(JSON.stringify([home.directory, home.directory, "/work/grok"]), JSON.stringify([home.of(null), home.of(provider(former)), home.of(provider("/work/grok"))]));
    Assert.areEqual("false,false,true,false", [home.isAdded(null), home.isAdded(provider(former)), home.isAdded(provider("/work/grok")),
      named.isAdded(provider("/elsewhere/grok"))].join(","));
  }

  @TestMethod
  public followsTheGrokHomeTheLatestLaunchsEnvironmentNamesForThePersonButNotForAnAddedProvider(): void {
    const provider = new Provider("a", "grok", "Work", "/work/grok", AuthStatus.Unknown, null, null, null, null, "t");
    const home = new GrokHome({ HOME: "/home/person", USERPROFILE: "/home/person" }, "/former");

    const launched = home.of(null, { GROK_HOME: "/moved/grok", HOME: "/home/person", USERPROFILE: "/home/person" });
    const added = home.of(provider, { GROK_HOME: "/again/grok", HOME: "/home/person", USERPROFILE: "/home/person" });

    Assert.areEqual(JSON.stringify(["/moved/grok", "/work/grok", "/again/grok", join("/home/person", ".grok")]),
      JSON.stringify([launched, added, home.of(null), home.directory]));
    Assert.areEqual("false,true", [home.isAdded(null), home.isAdded(provider)].join(","));
  }
}
