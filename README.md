# Invoicer

Owning a company in Turkey requires a paper trail of invoices to prove your sources of incomes. Unfortunately, the system in place for that is complete dogwater and doesn't allow creating invoices automatically on a schedule. This tool will automate it for you because nobody in their right mind would want to create invoices by hand every single month. Especially with multiple paying clients.

## Setup

This tool is meant to run on Github workflows every month. Fork this repo and allow Github workflows to run. You will have to set a `CONFIG` env variable to make it work. It's a stringified json because life is too short to create 23 different meaningful env variables. Sometimes you just gotta take the easier route and tell yourself it's ok.

You can copy over `config.example.json` and fill in the blanks with fields that apply to you, and set that as the env var in Github settings. Here's an example config if you can't even be bothered to click on the example file

```json
{
  "username": "ivd-login",
  "password": "ivd-password",
  "discord": {
    "enabled": true,
    "id": "discord-id",
    "webhookUrl": "discord-webhook-url"
  },
  "mailer": {
    "enabled": false,
    "host": "smtp.gmail.com",
    "from": "contact@xetera.dev",
    "port": 465,
    "secure": true,
    "auth": {
      "user": "",
      "pass": ""
    }
  },
  "smsRouter": {
    "secret": ""
  },
  "invoices": [
    {
      "nationalId": "2222222222",
      "companyName": "",
      "companyAddress": "",
      "serviceName": "Contractor Developer",
      "billAmount": "",
      "note": "",
      "currency": "USD"
    }
  ]
}
```

Required Fields:

- **username,password** - Your login for https://earsivportal.efatura.gov.tr/intragiris.html
- **smsRouter.secret** - Your secret key for [sms-router](https://github.com/xetera/sms-router)
- **invoice** - Leave the recipient's ID as ten 2's if your client isn't Turkish. I guess that's the magic value for foreign clients who don't have an ID number.

Anything with an `enabled` field is optional, but I strongly recommend you add a Discord webhook so you get notifications when there are errors. You can also add an email address but that's more for aesthetics since it doesn't do anything rn.

Invoicer doesn't actually send the invoice to the billed person. If you need that functionality, feel free to open a PR because I have no incentive to implement that myself.

This tool also requires you to have [sms-router](https://github.com/xetera/sms-router) set up on your phone so you can automate filling in SMS 2FA codes. It's quite simple actually, you just have to build the entire thing from source with no instructions. Or maybe I'll release an APK later.
