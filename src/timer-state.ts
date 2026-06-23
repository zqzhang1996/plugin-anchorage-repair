/**
 * Global timer state management for both Nosaki and repair ship timers.
 * According to wiki:
 * - Nosaki: "複数の艦隊でそれぞれ野埼を運用する場合でもタイマーは共通" (timer is shared across fleets)
 * - Repair ships: "修理時間のタイマーは共通" (repair timer is shared/common across fleets)
 */

type TimerStateListener = () => void
type PersistedTimerState = {
  lastNosakiRefresh: number
  lastRepairRefresh: number
}

const TIMER_STATE_STORAGE_KEY = 'poi-plugin-anchorage-repair:timer-state'
const DEFAULT_TIMER_STATE: PersistedTimerState = {
  lastNosakiRefresh: 0,
  lastRepairRefresh: 0,
}

const normalizeTimestamp = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0

class TimerStateManager {
  private lastNosakiRefresh: number = 0
  private lastRepairRefresh: number = 0 // Global repair timer (Akashi/Asahi Kai)
  private listeners: Set<TimerStateListener> = new Set()

  constructor() {
    const persistedState = this.loadPersistedState()
    this.lastNosakiRefresh = persistedState.lastNosakiRefresh
    this.lastRepairRefresh = persistedState.lastRepairRefresh
  }

  getLastNosakiRefresh(): number {
    return this.lastNosakiRefresh
  }

  setLastNosakiRefresh(timestamp: number): void {
    this.lastNosakiRefresh = timestamp
    this.persistState()
    this.notifyListeners()
  }

  resetNosakiTimer(): void {
    this.lastNosakiRefresh = Date.now()
    this.notifyListeners()
  }

  clearNosakiTimer(): void {
    this.lastNosakiRefresh = 0
    this.persistState()
    this.notifyListeners()
  }

  // Global repair timer methods (Akashi/Asahi Kai)
  getLastRepairRefresh(): number {
    return this.lastRepairRefresh
  }

  setLastRepairRefresh(timestamp: number): void {
    this.lastRepairRefresh = timestamp
    this.persistState()
    this.notifyListeners()
  }

  resetRepairTimer(): void {
    this.lastRepairRefresh = Date.now()
    this.notifyListeners()
  }

  clearRepairTimer(): void {
    this.lastRepairRefresh = 0
    this.persistState()
    this.notifyListeners()
  }

  subscribe(listener: TimerStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  private loadPersistedState(): PersistedTimerState {
    if (typeof window === 'undefined') {
      return DEFAULT_TIMER_STATE
    }

    try {
      const rawValue = window.localStorage.getItem(TIMER_STATE_STORAGE_KEY)
      if (!rawValue) return DEFAULT_TIMER_STATE

      const parsedValue = JSON.parse(rawValue) as Partial<PersistedTimerState>
      return {
        lastNosakiRefresh: normalizeTimestamp(parsedValue.lastNosakiRefresh),
        lastRepairRefresh: normalizeTimestamp(parsedValue.lastRepairRefresh),
      }
    } catch {
      return DEFAULT_TIMER_STATE
    }
  }

  private persistState(): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(
        TIMER_STATE_STORAGE_KEY,
        JSON.stringify({
          lastNosakiRefresh: this.lastNosakiRefresh,
          lastRepairRefresh: this.lastRepairRefresh,
        }),
      )
    } catch {
      // Ignore persistence failures and keep the in-memory timers working.
    }
  }
}

export const timerState = new TimerStateManager()
