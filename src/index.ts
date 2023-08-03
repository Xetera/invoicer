import * as fs from "fs"
import { Billing, BillingConfig, FOREIGN_TC_PLACEHOLDER } from "./billing"
import { Webhook } from "./discord-webhook"
import { exchangeRate } from "./exchange-rate"
import { Mailer } from "./mailer"
import { AugmentedInvoice, Invoice, readEnv } from "./env"
import { sub, add } from "date-fns"
import { maxBy } from "lodash"
import { Sms } from "./sms"
import { inspect } from "node:util"

async function invoiceFields(invoice: Invoice): Promise<AugmentedInvoice> {
  return {
    ...invoice,
    exchangeRate: await exchangeRate(invoice.currency),
  }
}

async function main() {
  const config = await (typeof process.env.CONFIG !== "undefined"
    ? readEnv(process.env.CONFIG)
    : fs.promises.readFile("./config.json", "utf-8").then(readEnv))

  const mailer = Mailer(config.mailer)
  const billing = await Billing({
    launch: {
      headless: false,
    },
  })

  const sms = await Sms(config.smsRouter)
  const webhook = Webhook(config.discord)

  process.on("unhandledRejection", (err) => {
    webhook.send((id) => ({
      content: `<@${id}> Unhandled rejection:\n${err}`,
    }))
  })

  try {
    await billing.login(config)
    const { goToInvoicePage } = await billing.goToMenuExpanded()

    const { searchInvoices } = await goToInvoicePage()

    const invoiceSearchParams = [
      add(new Date(), { days: 1 }),
      sub(new Date(), { days: 29 }),
    ] as const

    const { checkExistingForms } = await searchInvoices(...invoiceSearchParams)

    for (const invoice of config.invoices) {
      const forms = await checkExistingForms(invoice.companyName)
      if (
        forms.length > 0 &&
        forms.every((form) => form.status === "approved")
      ) {
        for (const form of forms) {
          console.log(
            `[invoice] An invoice for ${form.companyName} was already created on date ${form.date} with status [${form.status}]`
          )
        }
        console.log(
          `[invoice] Skipping invoice creation for ${invoice.companyName} because an invoice was already created this month`
        )
        await webhook.send((id) => ({
          content: `<@${id}> Skipping invoice creation for ${invoice.companyName} because an invoice was already created this month`,
          allowedMentions: {
            users: id ? [id] : [],
          },
        }))
        continue
      }

      const augmentedInvoice = await invoiceFields(invoice)
      const { goToFormPage } = await billing.goToMenuExpanded()
      const { fillForm } = await goToFormPage()
      try {
        const { confirmInvoiceCreation } = await fillForm(augmentedInvoice)
        await confirmInvoiceCreation()
      } catch (err) {
        console.error(err)
        webhook.send((id) => ({
          content: `<@${id}> Error occurred while creating invoice:\n${err.message}`,
          allowedMentions: {
            users: id ? [id] : [],
          },
        }))
        continue
      }

      const { goToInvoicePage } = await billing.goToMenuExpanded()
      const { searchInvoices } = await goToInvoicePage()

      // prevent namespacing issues
      {
        const { checkExistingForms } = await searchInvoices(
          ...invoiceSearchParams
        )
        const forms = await checkExistingForms(invoice.companyName)
        const latestForm = maxBy(
          forms.filter((form) => form.status === "pending"),
          (form) => form.date
        )
        if (!latestForm) {
          throw new Error(
            "Created a form but couldn't find it. Race condition? Are we that good at filling invoices?"
          )
        }
        const { approve } = await latestForm.select()
        // for some reason this takes a really long time
        const codePromise = sms.waitForCode({ timeout: 1000 * 60 * 5 })
        const { requestSms } = await approve()
        const { approveSms } = await requestSms()
        const code = await codePromise

        if (!code.metadata?.fields.otp) {
          console.log(inspect(code, { depth: null }))
          throw new Error(
            "Got an SMS but it didn't have an OTP. Something is very wrong."
          )
        }

        await approveSms(code.metadata.fields.otp)
        console.log("[invoice] Approved invoice!")
        await webhook.send((id) => ({
          content: `<@${id}> Approved invoice for ${invoice.companyName}`,
          allowedMentions: {
            users: id ? [id] : [],
          },
        }))
      }
    }
  } catch (err) {
    webhook.send((id) => ({
      content: `<@${id}> Error occurred while processing some step of the invoice:\n${err.message}`,
      allowedMentions: {
        users: id ? [id] : [],
      },
    }))
    console.error(err)
  }
}

main()
