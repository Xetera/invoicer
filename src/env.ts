import { z } from "zod"
import { MailerConfig } from "./mailer.js"
import { SmsConfig } from "./sms.js"

export const Invoice = z.object({
  nationalId: z.string(),
  companyName: z.string(),
  companyAddress: z.string(),
  serviceName: z.string(),
  billAmount: z.string(),
  note: z.string().optional(),
  currency: z.string().default("USD"),
})

export const AugmentedInvoice = Invoice.extend({
  exchangeRate: z.number(),
})

export type AugmentedInvoice = z.infer<typeof AugmentedInvoice>

export const Config = z.object({
  username: z.string(),
  password: z.string(),
  discord: z
    .object({
      id: z.string(),
      webhookUrl: z.string(),
    })
    .optional(),
  mailer: MailerConfig.optional(),
  // needs sms to work
  smsRouter: SmsConfig,
  invoices: z.array(Invoice),
  headless: z.coerce.boolean().optional().default(true),
})

export type Invoice = z.infer<typeof Invoice>
export type Config = z.infer<typeof Config>

export async function readEnv(configStr: string) {
  return Config.parseAsync(JSON.parse(configStr))
}
