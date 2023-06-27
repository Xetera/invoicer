type Rates = Record<string, number>

export async function exchangeRate(currency: string = "USD"): Promise<number> {
  const result = (await fetch(
    `https://open.er-api.com/v6/latest/${currency}`
  ).then((res) => res.json())) as { rates: Rates }

  return result.rates.TRY
}

const formatter = new Intl.NumberFormat("TR-tr")

export function formatNumber(num: number): string {
  return num.toString().replace(".", ",")
}
