import nodemailer from "nodemailer"
import type Mail from "nodemailer/lib/mailer"
import { z } from "zod"

export function Mailer(config?: MailerConfig) {
  if (!config) {
    console.log("No mailer config provided, using mock mailer")
  }

  const transport = nodemailer.createTransport(config)
  return {
    send(options: Omit<Mail.Options, "from">) {
      if (!config) {
        return
      }
      return transport.sendMail({
        from: config.from,
        ...options,
      })
    },
  }
}

export const MailerConfig = z.object({
  host: z.string(),
  from: z.string(),
  port: z.number(),
  secure: z.boolean(),
  auth: z.object({
    user: z.string(),
    pass: z.string(),
  }),
})

export type MailerConfig = z.infer<typeof MailerConfig>
