# Anchorage repair plugin for poi

[![npm package][npm-badge]][npm]

[简体中文说明](README-CN.MD)

## Description
A plugin to help with Akashi's HP repair and Nosaki's morale boost, featuring similar timer mechanics for both:

- [x] estimate anchorage repair time (Akashi, Akashi Kai, Asahi Kai)
- [x] support paired repair bonus (Akashi + Asahi Kai at positions 1-2)
- [x] estimate morale boost timing (Nosaki)
- [x] notify upon ship repair completes
- [x] support combined operations (Akashi + Nosaki, or Akashi + Asahi Kai + Nosaki)

## Limitations
- When you change the fleet composition, Kancolle API will not renew ships' HP, which may lead to inaccurate repair time estimation. You have to return to HQ screen to refresh ship data.

## Basic mechanism

### Akashi's anchorage repair (HP Recovery)
**Requirements:**
- Akashi (明石), Akashi Kai (明石改), or Asahi Kai (朝日改) must be fleet **flagship** (position 1)
- **Flagship health**: Must NOT be in moderate damage or worse (HP must be > 50% max HP)
- Flagship must not be in docking
- Base repair capability:
  - **Akashi/Akashi Kai**: Can repair herself and ship in 2nd slot (base: 2 ships) plus one ship slot per Ship Repair Facility equipped on flagship
  - **Asahi Kai**: Requires at least one Ship Repair Facility to repair even herself (base: 0 ships) plus one ship slot per Ship Repair Facility equipped on flagship
- **Paired Repair Bonus**: When Akashi series (Akashi/Akashi Kai) and Asahi Kai are at positions 1 and 2:
  - **Valid pairs**: Akashi + Asahi Kai OR Akashi Kai + Asahi Kai (in either order at positions 1-2)
  - **2nd position health requirement**: Must be below minor damage (HP > 75% max HP) for paired bonus to work
  - SRF on position 2 also counts toward repair range
  - If position 2 has SRF equipped and is healthy, repair speed increases by ~15% (time reduced to 85%)
  - With maximum 5 total SRF, can repair up to 7 ships in combined fleet operations
- **Repair target eligibility**: Ships can be repaired when at minor damage or better (HP > 50% max HP)
- Target ships must not be in docking

**Timer:** 20 minutes minimum for HP repair

### Nosaki's morale boost (Cond Recovery)
**Requirements:**
- Nosaki (or Kai) must be in **position 1 or 2** to start the timer
- At port return after 15 minutes, eligibility is checked:
  - Nosaki must be fully supplied
  - Nosaki must be undamaged to below minor damage (HP > 75% max HP)
  - Nosaki cond ≥ 30
  - Nosaki not in expedition or docking
- If eligible, boosts morale (cond value) for all fleet members except Nosaki herself.
- Nosaki: +2 cond per application, Nosaki Kai: +3 cond per application
- Maximum cond: 54
- Target ships: not in docking (damage state doesn't matter)
- Consumes 1 fuel per ship boosted

**Timer:** 15 minutes minimum for morale boost

### Combined Operation
- Both systems can work simultaneously in the same fleet
- Example configurations:
  - Akashi as flagship (repairs HP, 20min timer) + Nosaki in 2nd position (boosts morale, 15min timer)
  - Akashi/Akashi Kai as flagship + Asahi Kai in 2nd position = paired repair bonus (faster repair speed, extended range)
- **Timer behavior per WIKI**:
  - **Repair timer (HP)**: Shared/global across all fleets ("修理時間のタイマーは共通") - when any fleet has a repair ship flagship, all fleets share the same timer
  - **Morale timer (Nosaki)**: Shared/global across all fleets
- **Paired Repair**: When Akashi series (Akashi/Akashi Kai) and Asahi Kai occupy positions 1 and 2 (as described above), their Ship Repair Facilities are combined for extended range and faster repairs

### Docking repair time
The formula base on HP loss, level and ship type is already proved, while this value is also given in API's *api_ndock_time*.

### Repair time (Akashi)
- it takes at least 20 minutes to repair ships by at least 1 HP
- Above 20 minutes, the amount will be the same as ships in docking, rounded down.
- In the docking time formula, a 30-second bias is always added; the docking is actually finished, however, 1 minute earlier. And anchorage repair time will be **rounded up** to next minute.

### Timer reset rules
Both shared timers always exist on the server, but they are not sent directly in
API traffic. The plugin therefore calibrates them from observable API responses
and the already-updated local store state, and persists the latest timestamps in
local storage to survive plugin restarts.

- The plugin only treats `'/kcsapi/api_port/port'` and `'/kcsapi/api_req_hensei/change'` as timer-reset related events.

- **`port` event**:
  - If a timer is not initialized yet, restore it from persisted local data when available; otherwise start from the current timestamp.
  - If the elapsed time has reached the configured interval (20 minutes for repair / 15 minutes for Nosaki), reset the corresponding shared timer.
  - Whether any fleet can currently receive the effect only changes effect application, not timer progression itself.

- **`change` event**:
  - `api_ship_id === -2` (`随伴艦一括解除`, fleet-wide companion removal) does not reset either timer.
  - After the composition change, reset the shared timer if any affected fleet satisfies the timer condition:
    - HP repair: a repair ship is flagship
    - Morale boost: Nosaki / Nosaki Kai is in slot 1 or 2

- **Other events**:
  - Expedition departure / return, sortie, exercise, remodeling, docking, equipment changes, and similar events do not reset timers.
  - Those factors only affect whether the effect can be applied at that moment.

### Expedition-related tests
- Verified with both Akashi-side and Nosaki-side behavior: expedition departure and expedition return do not reset the shared timers.
- A fleet that is still on expedition does not receive anchorage repair / morale boost on the `port` settlement that follows expedition result collection, even if the timer has already expired.
- Using fleet save / restore to pick up Nosaki morale boosts between sorties has been stable in regular use.

### Timer Behavior (Important!)
- **Both timers are global/shared**: Per WIKI, both repair timer and Nosaki timer are shared across fleets.
- **Repair timer**: "修理時間のタイマーは共通" - fleets with repair ship flagships share one repair timer.
- **Nosaki timer**: "複数の艦隊でそれぞれ野埼を運用する場合でもタイマーは共通" - Nosaki timer is shared across all fleets.
- **Fleet presets**: Loading composition presets does not reset either timer.
- **Ship remodeling**: Nosaki → Nosaki Kai remodeling does not reset the Nosaki timer; the plugin treats remodeling as non-resetting for timer purposes.
- **Works everywhere**: Both systems work in all fleets (1-4) and strike force (7 ships).

### Corner cases
Following corner cases are not taken into consideration, thus the result may not behave as it could be.
- changing Akashi's slot items, more precisely, changing the numbers of Ship Repair Facilities (for Akashi),
- the timer being advanced from another client before this plugin receives an event that can re-calibrate it.

### Implemented Features
✓ Timer timestamps are persisted in local storage
✓ Both timers are shared globally across fleets
✓ Timers only advance / reset on `port` and `change` according to the observed rules
✓ Cross-fleet ship swaps check all affected fleets and reset shared timers when conditions are met
✓ Expedition departure / return, fleet presets, and ship remodeling do not reset timers

# Changelog
## v0.1
Initial version

## v0.2
Now the timer is always displayed for those who want to make use of composition preset bug.

## v0.3
The timer reset rules corrected
+ Returning to HQ within 20 minutes won't reset the timer,
+ Changing fleet composition within 20 minutes will immediately reset the timer. Otherwise a return to HQ is required

# References
- <https://wikiwiki.jp/kancolle/%E6%98%8E%E7%9F%B3>
- <https://wikiwiki.jp/kancolle/%E9%87%8E%E5%9F%BC>
- <https://wikiwiki.jp/kancolle/%E7%96%B2%E5%8A%B4%E5%BA%A6>
- <https://gist.githubusercontent.com/fujieda/440fa64d310c2b6960f3/raw>
- <https://kamigame.jp/%E8%89%A6%E3%81%93%E3%82%8C/%E6%94%BB%E7%95%A5%E3%82%AC%E3%82%A4%E3%83%89/%E6%98%8E%E7%9F%B3%E3%81%AE%E6%B3%8A%E5%9C%B0%E4%BF%AE%E7%90%86.html>
- <https://en.kancollewiki.net/wiki/Auxiliary_Ships_Mechanics>

# License
MIT

[npm-badge]: https://img.shields.io/npm/v/poi-plugin-anchorage-repair.svg?style=flat-square
[npm]: https://www.npmjs.org/package/poi-plugin-anchorage-repair
