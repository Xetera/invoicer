import { describe, it, expect } from "vitest"
import {
  exchangeRate as turkishExchangeRate,
  formatNumber,
} from "./exchange-rate.js"

describe("exchange rate", () => {
  it("converts USD to TRY", async () => {
    const rate = await turkishExchangeRate("USD")
    // TODO: this test will fail when AKP is no longer in power
    expect(rate).toBeGreaterThan(19)
  })
  it("formats numbers", () => {
    expect(formatNumber(19_123)).toBe("19,123")
  })
})
