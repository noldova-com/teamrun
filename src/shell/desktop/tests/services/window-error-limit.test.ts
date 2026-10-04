/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowErrorAdmission, WindowErrorLimit } from "@noldova/teamrun-shell-desktop";

@TestClass
export class WindowErrorLimitTests {
  private static readonly PERIOD: number = 60000;

  @TestMethod
  public writesTheFirstErrorsOfAPeriodThenGivesOneNoticeAndDropsTheRest(): void {
    const limit = new WindowErrorLimit(3, WindowErrorLimitTests.PERIOD, () => 1000);

    const admissions = Array.from({ length: 6 }, () => limit.admit());

    Assert.areEqual(JSON.stringify([
      WindowErrorAdmission.Write, WindowErrorAdmission.Write, WindowErrorAdmission.Write, WindowErrorAdmission.Notice, WindowErrorAdmission.Drop, WindowErrorAdmission.Drop
    ]), JSON.stringify(admissions));
  }

  @TestMethod
  public keepsDroppingErrorsThatGoOnArrivingUntilThePeriodHasPassedThenStartsAFreshOne(): void {
    let now = 0;
    const limit = new WindowErrorLimit(2, WindowErrorLimitTests.PERIOD, () => now);
    const admitAt = (time: number): WindowErrorAdmission => {
      now = time;
      return limit.admit();
    };

    const admissions = [0, 1, 2, 30000, 59999, 60000, 60001, 60002, 90000, 119999, 120000].map(admitAt);

    Assert.areEqual(JSON.stringify([
      WindowErrorAdmission.Write, WindowErrorAdmission.Write, WindowErrorAdmission.Notice, WindowErrorAdmission.Drop, WindowErrorAdmission.Drop,
      WindowErrorAdmission.Write, WindowErrorAdmission.Write, WindowErrorAdmission.Notice, WindowErrorAdmission.Drop, WindowErrorAdmission.Drop,
      WindowErrorAdmission.Write
    ]), JSON.stringify(admissions));
  }

  @TestMethod
  public startsTheNextPeriodWithItsFirstErrorAfterAQuietSpell(): void {
    let now = 0;
    const limit = new WindowErrorLimit(1, WindowErrorLimitTests.PERIOD, () => now);

    limit.admit();
    now = 200000;
    const first = limit.admit();
    now = 259999;
    const second = limit.admit();

    Assert.areEqual(JSON.stringify([WindowErrorAdmission.Write, WindowErrorAdmission.Notice]), JSON.stringify([first, second]));
  }

  @TestMethod
  public readsTheSystemClockByDefault(): void {
    Assert.areEqual(WindowErrorAdmission.Write, new WindowErrorLimit(1, WindowErrorLimitTests.PERIOD).admit());
  }
}
