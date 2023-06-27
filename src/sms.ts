import { SmsRouter } from "sms-router"
import { z } from "zod"

export async function Sms(config: SmsConfig) {
  const client = await SmsRouter.withExtractor({
    secret: config.secret,
  })

  return {
    async waitForCode(opts: { timeout: number }) {
      return client.waitFor(
        {
          metadata: {
            app: "interaktif-vergi-dairesi",
            pattern: "invoice-confirmation",
          },
        },
        opts
      )
    },
  }
}

export const SmsConfig = z.object({
  secret: z.string(),
})

export type SmsConfig = z.infer<typeof SmsConfig>
