/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpEnvironment } from "@noldova/teamrun.providers";

@TestClass
export class AcpEnvironmentTests {
  @TestMethod
  public copiesOnlyTheVariablesThePatternLeavesAndChangesNoneOfTheBase(): void {
    const base = { PATH: "/bin", FAKE_TOKEN: "hidden", LANG: "en_US.UTF-8" };
    const environment = AcpEnvironment.copy(base, /TOKEN/);

    Assert.areEqual("LANG,PATH", Object.keys(environment).sort().join(","));
    environment["PATH"] = "/other";
    Assert.areEqual("/bin", base.PATH);
  }

  @TestMethod
  public putsBackTheBasesHomeAndAppDataFoldersXAuthorityAndBrowserNamedInAnyCaseAndLeavesOutThoseTheBaseLacks(): void {
    const environment = { PATH: "/bin", GROK_HOME: "/profile", HOME: "/profile/home", userprofile: "/profile/home", APPDATA: "/profile/roaming",
      LOCALAPPDATA: "/profile/local", XDG_CONFIG_HOME: "/profile/config", XDG_DATA_HOME: "/profile/data", BROWSER: "/profile/browser" };
    const base = { PATH: "/usr/bin", HOME: "/home/person", USERPROFILE: "C:/Users/person", LocalAppData: "C:/Users/person/AppData/Local",
      XDG_CONFIG_HOME: "/home/person/.config", XAUTHORITY: "/run/user/1000/xauth", Browser: "firefox", FAKE_TOKEN: "hidden" };

    const signingIn = AcpEnvironment.forSignIn(environment, base);

    Assert.areEqual(["Browser=firefox", "GROK_HOME=/profile", "HOME=/home/person", "LocalAppData=C:/Users/person/AppData/Local", "PATH=/bin",
      "USERPROFILE=C:/Users/person", "XAUTHORITY=/run/user/1000/xauth", "XDG_CONFIG_HOME=/home/person/.config"].join(","),
      Object.entries(signingIn).map(([name, value]) => `${name}=${value}`).sort().join(","));
    Assert.areEqual("/profile/home", environment.HOME);
  }
}
