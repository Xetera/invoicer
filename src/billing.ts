import { chromium, ElementHandle, LaunchOptions, Page } from "playwright"
import { formatNumber } from "./exchange-rate.js"
import { sub, add, format, parse } from "date-fns"

const form = {
  currencySelector: "[rel=paraBirimi] select",
  currencyUSD: "USD",
  exchangeSelector: "[rel=dovzTLkur] input",
  billTypeSelector: "[rel=faturaTipi] select",
  billTypeExemption: "ISTISNA",
  nationalId: "[rel=vknTckn] input",
  companyName: "[rel=aliciUnvan] input",
  countrySelector: '[rel="ulke"] select',
  countryUS: "Amerika Birleşik Dev",
  companyAddress: "[rel=bulvarcaddesokak] textarea",
  addRow: 'input[value="Satır Ekle"]',
  submit: '[rel="olustur"] input',
  serviceName:
    "table[rel=malHizmetTable] tbody > tr[rel='0'] td:nth-child(4) input",
  unitCount:
    "table[rel=malHizmetTable] tbody > tr[rel='0'] td:nth-child(5) input",
  unitsTypeSelector:
    "table[rel=malHizmetTable] tbody > tr[rel='0'] td:nth-child(6) select",
  unitsTypeAmountText: "Adet",
  billAmount:
    "table[rel=malHizmetTable] tbody > tr[rel='0'] td:nth-child(7) input",
  note: "[rel=not] textarea",
}

type BillingOptions = {
  launch: LaunchOptions
}

export const FOREIGN_TC_PLACEHOLDER = "2222222222"

export async function Billing(opts: BillingOptions) {
  const browser = await chromium.launch(opts.launch)
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
    viewport: {
      width: 1200,
      height: 1000,
    },
  })

  async function login(config: BillingConfig) {
    console.log("[login] Logging in...")
    await page.goto("https://earsivportal.efatura.gov.tr/intragiris.html")
    await page.type("#userid", config.username)
    await page.type("#password", config.password)
    await page.click("button[type=submit]")
  }

  async function goToMenuExpanded() {
    console.log("[nav] Going to menu")
    await page.waitForSelector(".csc-combobox.select-project")
    await page
      .locator(".csc-combobox.select-project")
      .selectOption("MAINTREEMENU")
    //   // dropdown selectors
    await page.locator('a:has-text("Belge İşlemleri")').click()

    // we can only attempt to fill a form once we're
    // inside the menu
    return {
      goToInvoicePage,
      goToFormPage,
    }
  }

  async function goToInvoicePage() {
    console.log("[nav] Going to invoice page")
    await page
      .locator('a:has-text("Düzenlenen Belgeler e-Arşiv Fatura (İnteraktif)")')
      .click()

    await page.waitForSelector(".csc-tarih")
    return {
      searchInvoices,
    }
  }

  async function searchInvoices(startDate: Date, endDate: Date) {
    console.log("[invoice] Searching invoices")
    const [end, start] = (await page.$$(".csc-tarih")) as [
      ElementHandle<HTMLInputElement>,
      ElementHandle<HTMLInputElement>
    ]

    page.waitForTimeout(100)

    start.evaluate(
      (el, date) => (el.value = date),
      format(startDate, "dd/MM/yyyy")
    )
    end.evaluate((el, date) => (el.value = date), format(endDate, "dd/MM/yyyy"))

    page.waitForTimeout(100)

    await page.locator('input[rel="sorgula"]').click()

    return {
      checkExistingForms,
    }
  }

  async function requestSms() {
    console.log("[invoice] Requesting SMS")
    await page.waitForSelector("[rel=onayCheckbox] input", { timeout: 10000 })
    await page.locator("[rel=onayCheckbox] input").click()
    await page.locator('input[value="Şifre Gönder"]').click()
    return { approveSms }
  }

  async function approveSms(code: string) {
    console.log(`[invoice] Approving SMS with OTP [${code}]`)
    await page.waitForSelector("input[type=password]")
    await page.locator("input[type=password]").type(code)
    await page.click('input[value="Onayla"]')
  }

  async function checkExistingForms(companyName: string) {
    console.log("[invoice] Checking existing invoices for", companyName)
    // there's a checkbox on the header too, we only wanna make sure we're waiting for the real results
    const checkbox = ".csc-table table tbody input[type=checkbox]"
    try {
      await page.waitForSelector(checkbox, { timeout: 3000 })
    } catch (err) {
      // no existing forms
      return []
    }

    const rows = await page
      // there are trs for thead too
      .locator(".csc-table table tbody tr")
      .filter({ hasText: companyName })
      .elementHandles()

    return await Promise.all(
      rows.map(async (row) => {
        const [_checkbox, documentNum, receiverId, companyName, date] =
          await Promise.all((await row.$$("td")).map((r) => r.textContent()))

        const checkbox = await row.$("input[type=checkbox]")
        if (!checkbox) {
          throw new Error("No checkbox found. Impossible state")
        }

        // approved invoices have a checkbox somewhere
        const approved = Boolean(await row.$(".fa-check"))
        const deleted = Boolean(await row.$(".fa-remove"))

        async function approve() {
          await page.locator('input[value="GİB İmza"]').click()
          return { requestSms }
        }

        async function select() {
          await checkbox?.click()
          return { approve }
        }

        return {
          documentNum,
          receiverId,
          companyName,
          date: date ? parse(date, "dd-MM-yyyy", new Date()) : undefined,
          status: approved ? "approved" : deleted ? "deleted" : "pending",
          select,
        }
      })
    )
  }

  async function confirmInvoiceCreation() {
    console.log("[invoice] Confirming invoice creation")
    await page.waitForSelector(".cs-popup-window", { timeout: 10000 })
    await page.click('input[value="Tamam"]')
  }

  async function goToFormPage() {
    await page.waitForSelector(".csc-combobox.select-project")
    await page
      .locator(".csc-combobox.select-project")
      .selectOption("MAINTREEMENU")
    //   // dropdown selectors
    await page.locator('a:has-text("Belge İşlemleri")').click()
    await page
      .locator('a:has-text("e-Arşiv Fatura (İnteraktif) Oluştur")')
      .click()

    return { fillForm }
  }

  async function fillForm(invoice: BillingInvoiceFields) {
    console.log("[form] Filling form")
    // page.waitForSelector("")
    await page.locator(form.currencySelector).selectOption(form.currencyUSD)
    await page
      .locator(form.billTypeSelector)
      .selectOption(form.billTypeExemption)

    await page.locator(form.exchangeSelector).focus()

    // turkish numbers like 19,500.5 are formatted as 19.500,5
    // I don't know why...
    const exchangeRateFormatted = formatNumber(invoice.exchangeRate)

    await page.locator(form.exchangeSelector).type(exchangeRateFormatted)

    await page.locator(form.nationalId).type(invoice.nationalId)
    await page.locator(form.companyName).focus()
    // needed for some kind of race condition related to
    // angular controlled inputs?
    await page.waitForTimeout(200)
    await page.locator(form.companyName).type(invoice.companyName)
    // await page.waitForTimeout(100)
    await page.locator(form.countrySelector).selectOption(form.countryUS)
    await page.locator(form.companyAddress).type(invoice.companyAddress)

    await page.locator(form.addRow).click()

    await page.waitForTimeout(100)
    await page.locator(form.serviceName).focus()
    await page.locator(form.serviceName).type(invoice.serviceName)
    // clear all units first
    await page.locator(form.unitCount).focus()
    await page.keyboard.press("Meta+A")
    await page.keyboard.press("Backspace")
    await page.locator(form.unitCount).type("1")
    await page
      .locator(form.unitsTypeSelector)
      .selectOption({ label: form.unitsTypeAmountText })
    await page.locator(form.billAmount).focus()
    await page.waitForTimeout(100)
    await page.locator(form.billAmount).type(invoice.billAmount)

    if (invoice.note) {
      await page.locator(form.note).type(invoice.note)
    }

    await page.locator(form.submit).click()

    return { confirmInvoiceCreation }
  }

  return {
    unknownIdPlaceholder: page,
    login,
    goToMenuExpanded,
  }
}

Billing.fromEnv = async (opts: BillingOptions) => {
  if (!process.env.BILLING_CONFIG) {
    throw Error("Missing env variable BILLING_CONFIG")
  }
  return Billing(opts)
}

export type BillingInvoiceFields = {
  nationalId: string
  companyName: string
  companyAddress: string
  serviceName: string
  billAmount: string
  exchangeRate: number
  note?: string
}

export type BillingCredentials = {
  username: string
  password: string
}

export type BillingConfig = BillingCredentials
