import { afterEach, describe, expect, it, vi } from "vitest"
import { detectAccounts, toAccounts } from "../src/detect"
import {
  clearHint,
  loadHint,
  profilePreviewEnabled,
  saveHint,
  setProfilePreview,
} from "../src/store"

function stubWindow() {
  const storage = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
    clear: () => storage.clear(),
  }
  return storage
}

afterEach(() => {
  ;(globalThis as any).soverity = undefined
  vi.restoreAllMocks()
})

describe("detection layers", () => {
  it("layer 1: reads accounts from the injected provider", async () => {
    stubWindow()
    ;(globalThis as any).soverity = {
      listAccounts: async () => [
        { id: "a1", avatarUrl: "https://x/a.png", username: "nova", lastUsed: true },
      ],
    }
    const { accounts } = await detectAccounts({})
    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.username).toBe("nova")
  })

  it("layer 1: ignores providers that throw or return junk", async () => {
    ;(globalThis as any).soverity = {
      listAccounts: async () => {
        throw new Error("locked")
      },
    }
    const { accounts } = await detectAccounts({ timeoutMs: 50 })
    expect(accounts).toHaveLength(0)
  })

  it("falls through to no accounts when nothing is detected", async () => {
    const { accounts, hasPasskey } = await detectAccounts({ timeoutMs: 50 })
    expect(accounts).toHaveLength(0)
    expect(typeof hasPasskey).toBe("boolean")
  })

  it("toAccounts filters hints missing display fields", () => {
    const accounts = toAccounts([
      { avatarUrl: "https://x/a.png", username: "nova" },
      { avatarUrl: "", username: "ghost" },
      { avatarUrl: "https://x/c.png" } as any,
    ])
    expect(accounts).toHaveLength(1)
  })
})

describe("local hint store", () => {
  it("saves, loads, and clears the three display fields", () => {
    const storage = stubWindow()
    saveHint({ avatarUrl: "https://x/a.png", username: "nova" })
    const stored = storage.get("soverity:hint") ?? "null"
    expect(JSON.parse(stored)).toEqual({
      avatarUrl: "https://x/a.png",
      username: "nova",
    })
    expect(loadHint()?.username).toBe("nova")
    clearHint()
    expect(loadHint()).toBeNull()
  })

  it("profile preview defaults to on and can be disabled", () => {
    stubWindow()
    expect(profilePreviewEnabled()).toBe(true)
    setProfilePreview(false)
    expect(profilePreviewEnabled()).toBe(false)
    setProfilePreview(true)
    expect(profilePreviewEnabled()).toBe(true)
  })

  it("loadHint returns null on corrupted JSON", () => {
    const storage = stubWindow()
    storage.set("soverity:hint", "{oops")
    expect(loadHint()).toBeNull()
  })
})
