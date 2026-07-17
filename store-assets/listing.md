# Play Console store listing — copy to paste in

Everything here is meant to be pasted directly into Play Console's store
listing form. Where a field has a character limit, the count is noted —
Play Console validates live, so trim there if Tamil text counts differently
than expected.

## App details

- **App name** (max 30 chars): `Grocy: தமிழ் குரல் பட்டியல்`
  (fallback if that's over the limit: just `Grocy`)
- **Category**: Shopping (Productivity is a reasonable alternate)
- **Contact email**: contact@grocy.store
- **Privacy policy URL**: https://grocy.store/privacy
- **Website**: https://grocy.store

## Short description (max 80 characters)

```
தமிழில் பேசி மளிகை பட்டியல் உருவாக்குங்கள் — இலவசம், தனியுரிமையானது
```

## Full description (max 4000 characters)

```
மளிகை பட்டியல் எழுத வேண்டாம் — பேசுங்கள்.

Grocy உங்கள் தமிழ் குரலைக் கேட்டு, ஒரு தெளிவான மளிகை பட்டியலாக மாற்றும் ஆப். இயல்பாகப் பேசுங்கள் — நிறுத்தினாலும், திருத்தினாலும், மனது மாறினாலும் பரவாயில்லை, Grocy புரிந்துகொள்ளும்.

என்ன செய்யும்:
• மைக்கை அழுத்தி பேசுங்கள் — உங்கள் வார்த்தைகள் நேரலையில் தோன்றும்
• முடிந்ததும், ஒரு தெளிவான பட்டியல் தயார்
• விரும்பினால், பொருட்களை வகைப்படுத்தி, மதிப்பீட்டு விலையும் காட்டும்
• WhatsApp-லோ, வேறு எங்காவதோ — ஒரே தட்டலில் பகிரலாம்
• அடிக்கடி வாங்கும் பொருட்களை நினைவில் வைத்து, விரைவாக சேர்க்க உதவும்

தனியுரிமை முதலில்:
குரல் அடையாளம் காணுதல் உங்கள் மொபைலிலேயே நடக்கிறது. பட்டியலைப் புரிந்துகொள்ள ஒரு AI மாடல் தேவை - எந்த கணக்கும் தேவைப்படாமல், முதல் பயன்பாட்டிலேயே ஒரு இலவச திட்டம் தானாக இயங்கும். மாதாந்திர இலவச வரம்பு முடிந்துவிட்டால், உங்கள் சொந்த OpenRouter கணக்கை (இலவசமாகத் தொடங்கலாம்) இணைத்து வரம்பின்றி தொடரலாம். எந்நேரமும், உங்கள் மளிகை பட்டியல் தரவை Grocy சேகரிக்கவோ, சேமிக்கவோ மாட்டாது.

யாருக்காக:
தினமும் அல்லது வாரம் ஒருமுறை மளிகை கடைக்குச் செல்பவர்களுக்கு, தட்டச்சு செய்வதைவிட பேசுவது எளிதானவர்களுக்கு, தமிழில் இயல்பாகச் சிந்தித்து பட்டியலிட விரும்புபவர்களுக்கு.

விளம்பரங்கள் இல்லை. கணக்கு தேவையில்லை (Grocy-டன்). உங்கள் தரவு உங்களுடையது.
```

## Release notes ("What's new", first release)

```
முதல் வெளியீடு! 🎉

தமிழில் பேசி மளிகை பட்டியல் உருவாக்குங்கள்:
• குரல் மூலம் பட்டியல் — இயல்பாகப் பேசுங்கள், திருத்தங்களையும் Grocy புரிந்துகொள்ளும்
• பொருட்களை வகைப்படுத்தி, மதிப்பீட்டு விலையும் காட்டும்
• WhatsApp-லோ உடனே பகிரலாம்
• கணக்கு தேவையில்லை, விளம்பரங்கள் இல்லை — உங்கள் தரவு உங்களுடையது
```

Play Console requires a "default language" for the app separate from the
actual Tamil content (likely `en-IN`), so the release notes screen may ask
for both a `<en-IN>` block and a `<ta>` block - use the Tamil text above for
`<ta>` and this for `<en-IN>`:

```
First release! 🎉

Create your Tamil grocery list by speaking:
• Voice-powered lists — speak naturally, Grocy understands corrections too
• Items get categorized with estimated prices
• Share instantly on WhatsApp
• No account required, no ads — your data is yours
```

## Content rating questionnaire

Done interactively in Play Console (IARC questionnaire), not pasted text —
but every question (violence, gambling, user-generated content shared with
others, location sharing, etc.) should be answered **No**. This is a
grocery list app with no social features, no content sharing between
strangers, nothing objectionable. Expect it to land on **Everyone** / **PEGI 3**.

## Data Safety form

This is the one section worth getting right carefully, since Grocy's
architecture (almost no backend, mostly direct-to-OpenRouter) doesn't map
cleanly onto the form's usual assumptions. The accurate, honest answers:

**Does your app collect or share any of the required user data types?**
Yes — but not *to the developer*. Be precise here rather than picking
"No data collected," since the transcript/list text you speak *is*
transmitted off the device (to OpenRouter, using an API key stored on the
device - either an auto-provisioned free one or a connected personal
account), even though Grocy's developer never sees or stores it. The one
Grocy-operated endpoint (`provision/`) only ever receives a "give me a
key" request with no list content, voice data, or personal information in
it at all.

**Data type to declare**: App activity → *User-generated content* (the
transcribed grocery list text).
- Collected? No (not stored by the app developer)
- Shared? Yes — with OpenRouter, a third-party AI service, using a key
  stored on the user's device
- Purpose: App functionality (required for the app to work at all)
- Is this data processed ephemerally? Yes, reasonable to mark this — it's
  sent per-request to fulfil the extraction/categorization/pricing call,
  not retained by Grocy anywhere
- Is data encrypted in transit? Yes (HTTPS)
- Can users request data deletion? Not applicable to Grocy (nothing is
  stored by the developer); local app data clears on uninstall; OpenRouter
  account data is managed through the user's own OpenRouter account

**Everything else (location, contacts, photos, financial info, health,
messages, etc.)**: Not collected, not shared — Grocy has no access to any
of it.

**Security practices section**:
- "Data is encrypted in transit" → Yes
- "You can request that data be deleted" → Not applicable / no data is
  retained by the developer to delete
- "Committed to Play Families Policy" → No (not directed at children)

## App access (sign-in details)

**"Is any part of your app restricted?"** → **No**, as of the auto-
provisioning change (see `provision/` and `mobile/src/lib/openrouterAuth.ts`
- `ensureOpenRouterKey()`). The app now mints a free, capped OpenRouter key
automatically the first time it's needed, so a reviewer can record a list,
tap the checkmark, organize it, and share it - the entire app - without
ever signing into anything. The "connect your own OpenRouter account" flow
in Settings still exists, but it's an optional upgrade once the free
monthly quota runs out, not a gate on any content, so it shouldn't count as
"restricted" under Play's definition.

(This replaces the earlier plan of handing Google reviewer credentials to a
funded OpenRouter account - no longer necessary.)

## Other declarations

Straightforward "No" answers for a grocery-list app with no meaningful
backend (one endpoint that issues free API keys and sees no user data -
see the App access section above):

- **Ads**: No (app contains no ads)
- **In-app purchases**: No
- **Target audience / designed for children**: No - select an adult age
  range (e.g. 18+), not a children's category. Nothing in the app is
  child-directed.
- **News app**: No
- **COVID-19 contact tracing / status app**: No
- **Government app**: No
- **Financial features** (lending, crypto exchange, payment processing,
  etc.): No - the estimated prices shown are informational only, Grocy
  never handles a real transaction or payment.

## Screenshots & graphics

All prepared and ready to upload:
- `store-assets/screenshots/*.png` — 4 phone screenshots (1080×1920)
- `store-assets/graphics/feature-graphic.png` — 1024×500 feature graphic
- `store-assets/graphics/icon-512.png` — 512×512 hi-res icon (downscaled
  from `mobile/assets/icon.png`, which is 1024×1024)
