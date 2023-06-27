import { z } from "zod"
import { WebhookClient } from "discord.js"

export function Webhook(config?: DiscordConfig) {
  const client =
    config &&
    new WebhookClient({
      url: config.webhookUrl,
    })

  return {
    async send(params: (id: string) => Parameters<WebhookClient["send"]>[0]) {
      if (client) {
        client.send(params(config.id))
      }
    },
  }
}

const DiscordConfig = z.object({
  id: z.string(),
  webhookUrl: z.string(),
})

export type DiscordConfig = z.infer<typeof DiscordConfig>
