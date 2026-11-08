import { getAppBaseUrl } from "@/lib/utils/app-url"

/**
 * Email templates, kept in the repo so they're versioned and reviewed like code.
 * Each returns subject + HTML + plain text (Postmark sends both; text helps deliverability).
 * Inline styles only: most email clients ignore <style> blocks.
 */

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const BRAND = "#0d9488"

export function appUrl(path = ""): string {
  return `${getAppBaseUrl("https://www.pettaleai.com")}${path}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:${BRAND}">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
</td></tr></table>`
}

/** Shared layout: header, body, and a footer with who we are and where to manage settings */
function layout(bodyHtml: string, preheader: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pet Tale AI</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:20px 28px;background:${BRAND};color:#ffffff;font-size:20px;font-weight:700">🐾 Pet Tale AI</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.6">${bodyHtml}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:16px 28px;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
Pet Tale AI is made by Glendale AI, LLC.<br>
Questions? Just reply to this email.<br>
<a href="${appUrl("/dashboard/settings")}" style="color:#6b7280">Account settings</a> · <a href="${appUrl("/privacy")}" style="color:#6b7280">Privacy</a>
</td></tr></table>
</td></tr></table>
</body></html>`
}

function textFooter(): string {
  return `\n\n—\nPet Tale AI, made by Glendale AI, LLC. Questions? Just reply to this email.\nAccount settings: ${appUrl("/dashboard/settings")}`
}

export function welcomeEmail(params: { name?: string | null }): RenderedEmail {
  const hi = params.name ? `Hi ${escapeHtml(params.name)},` : "Hi there,"
  const createUrl = appUrl("/dashboard/reels/new?utm_source=email&utm_medium=transactional&utm_campaign=welcome")
  return {
    subject: "Welcome to Pet Tale AI 🐾 Your first tale is on us",
    html: layout(
      `<p style="margin:0 0 16px">${hi}</p>
<p style="margin:0 0 16px">Welcome to Pet Tale AI! Pick any video of your pet and we'll turn it into a narrated, captioned tale you can share anywhere.</p>
<p style="margin:0 0 4px"><strong>Your first tale is free.</strong> It takes about a minute:</p>
<ol style="margin:8px 0 0;padding-left:20px">
<li>Choose a pet video from your phone</li>
<li>Pick a voice and vibe, or keep ours</li>
<li>Get a vertical video with voice, captions and a share link</li>
</ol>
${button("Make my first tale", createUrl)}
<p style="margin:0;color:#6b7280;font-size:14px">Tip: short, well-lit clips of 10 to 30 seconds make the best tales.</p>`,
      "Your first tale is free. Turn any pet video into a narrated story in about a minute.",
    ),
    text: `${params.name ? `Hi ${params.name},` : "Hi there,"}

Welcome to Pet Tale AI! Pick any video of your pet and we'll turn it into a narrated, captioned tale you can share anywhere.

Your first tale is free. It takes about a minute:
1. Choose a pet video from your phone
2. Pick a voice and vibe, or keep ours
3. Get a vertical video with voice, captions and a share link

Make your first tale: ${createUrl}

Tip: short, well-lit clips of 10 to 30 seconds make the best tales.${textFooter()}`,
  }
}

export function taleReadyEmail(params: {
  name?: string | null
  petName?: string | null
  entryId: string
  /** Set when the pet's personality is still at defaults: adds a gentle "tell us about them" line */
  personalizePetId?: string | null
}): RenderedEmail {
  const pet = params.petName?.trim() || "your pet"
  const petHtml = escapeHtml(pet)
  const personalizeUrl = params.personalizePetId
    ? appUrl(
        `/dashboard/pets/${params.personalizePetId}/personality?utm_source=email&utm_medium=transactional&utm_campaign=tale_ready_personalize`,
      )
    : null
  const them = pet === "your pet" ? "them" : petHtml
  const viewUrl = appUrl(`/dashboard/reels/${params.entryId}?utm_source=email&utm_medium=transactional&utm_campaign=tale_ready`)
  const hi = params.name ? `Hi ${escapeHtml(params.name)},` : "Hi there,"
  return {
    subject: `${pet === "your pet" ? "Your" : `${pet}'s`} tale is ready 🎬`,
    html: layout(
      `<p style="margin:0 0 16px">${hi}</p>
<p style="margin:0 0 16px">Good news: ${petHtml}'s tale is finished, with narration and captions.</p>
${button("Watch and share", viewUrl)}
<p style="margin:0;color:#6b7280;font-size:14px">From there you can download it or copy a share link for TikTok, Instagram, Facebook or a text.</p>
${
  personalizeUrl
    ? `<div style="margin:24px 0 0;padding:16px;background:#fffbeb;border-radius:12px;border:1px solid #fde68a">
<p style="margin:0 0 6px;font-weight:600">✨ Want the next one to sound even more like ${them}?</p>
<p style="margin:0 0 10px;color:#4b5563;font-size:14px">Six quick taps tell us who ${them} really is: the zoomies, the side-eye, the couch hogging. We write the narration in that voice.</p>
<a href="${personalizeUrl}" style="color:${BRAND};font-weight:600;text-decoration:none">Tell us about ${them} →</a>
</div>`
    : ""
}`,
      `${pet === "your pet" ? "Your" : `${pet}'s`} tale is ready to watch and share.`,
    ),
    text: `${params.name ? `Hi ${params.name},` : "Hi there,"}

Good news: ${pet}'s tale is finished, with narration and captions.

Watch and share: ${viewUrl}

From there you can download it or copy a share link for TikTok, Instagram, Facebook or a text.${
      personalizeUrl
        ? `

Want the next one to sound even more like ${pet === "your pet" ? "them" : pet}? Six quick taps tell us who they really are: ${personalizeUrl}`
        : ""
    }${textFooter()}`,
  }
}

export function taleGiftedEmail(params: { name?: string | null; tales: number; note?: string | null }): RenderedEmail {
  const count = params.tales === 1 ? "a free tale" : `${params.tales} free tales`
  const createUrl = appUrl("/dashboard/reels/new?utm_source=email&utm_medium=transactional&utm_campaign=tale_gift")
  const hi = params.name ? `Hi ${escapeHtml(params.name)},` : "Hi there,"
  const note = params.note?.trim()
  return {
    subject: `We've added ${count} to your account 🎁`,
    html: layout(
      `<p style="margin:0 0 16px">${hi}</p>
<p style="margin:0 0 16px">We've added ${count} to your Pet Tale AI account. ${params.tales === 1 ? "It doesn't" : "They don't"} expire.</p>
${note ? `<p style="margin:0 0 16px;padding:12px 16px;background:#f0fdfa;border-left:4px solid ${BRAND};border-radius:4px">${escapeHtml(note)}</p>` : ""}
${button("Make a tale", createUrl)}`,
      `We've added ${count} to your account.`,
    ),
    text: `${params.name ? `Hi ${params.name},` : "Hi there,"}

We've added ${count} to your Pet Tale AI account. ${params.tales === 1 ? "It doesn't" : "They don't"} expire.
${note ? `\n${note}\n` : ""}
Make a tale: ${createUrl}${textFooter()}`,
  }
}

export function accountDeletedEmail(params: { name?: string | null; planCancelled: boolean }): RenderedEmail {
  const hi = params.name ? `Hi ${escapeHtml(params.name)},` : "Hi there,"
  const plan = params.planCancelled ? " Your plan has been cancelled, so you won't be charged again." : ""
  return {
    subject: "Your Pet Tale AI account has been deleted",
    html: layout(
      `<p style="margin:0 0 16px">${hi}</p>
<p style="margin:0 0 16px">Your Pet Tale AI account, your pets and your private tales have been deleted.${plan}</p>
<p style="margin:0 0 16px">Tales you made public stay up at their links. If you'd like any of those removed, just reply to this email.</p>
<p style="margin:0 0 16px">Thanks for making tales with us. You're always welcome back.</p>`,
      "Your account has been deleted.",
    ),
    text: `${params.name ? `Hi ${params.name},` : "Hi there,"}

Your Pet Tale AI account, your pets and your private tales have been deleted.${plan}

Tales you made public stay up at their links. If you'd like any of those removed, just reply to this email.

Thanks for making tales with us. You're always welcome back.${textFooter()}`,
  }
}
