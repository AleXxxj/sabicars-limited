# Sabicars platform: the project journal

One section per working day, newest first. Each records what Alex John asked for, what was decided and why, ideas raised, what was rejected or reversed, what was built (with commit hashes on the `platform` branch), and what was left open. Plain English, no secrets. The companion document is [PROJECT-BOOK.md](PROJECT-BOOK.md), which explains how the platform is made.

Days before 8 November 2026 were reconstructed on 8 November from the saved Claude Code transcripts and the commit history; from 8 November on, the day's entry is written at the end of the day (a Claude Code hook refuses to end a day with commits until it is).

## 2026-11-08 (Sunday)
**Instructions from Alex:**
- Staff use only the old admin; nobody else has access to the new one yet.
- Social usernames: TikTok `sabi.cars`, Instagram `toyotabusesnigeria` (renamed from `sabicarsltd`).
- "Spend Management, what's the importance, and why should I turn on Flat Rate CDN?"
- Keep the go-live guide's ticks current: "click those that are done, then we know those that are still to be done."
- Finished every Vercel step; asked where to find the `CRON_SECRET` for GitHub (answer: a cron-job.org job's Advanced tab, after the word Bearer).
- UptimeRobot set up; test alert reached email and phone.
- The 2016 4Runner Limited is ₦53m (the ₦36m copy is wrong).
- Hero: "Car dealer in Lagos" → "Car dealer in Nigeria"; the CAC line moves to the footer as the operator's registration (spec section 3.13).
- Hero photos: "reselect nice and standard vehicles… it should not zoom… or what do you think?" Then: "go, build and show me the screenshot."
- After seeing the framed layout: "it doesn't feel like a dealer app anymore, I don't like the look." Then: "don't push it live, return it to the existing design, the vehicle selection is not blending with the site."
- "Can we edit or add or remove the vehicle images on the hero from the admin?" and "the old admin has a section to add a video link to the hero… were you aware?" Then: "go add video box to the admin."
- "Load the live site and tell me your view about the new hero video I added" (Toyota USA's 2024 Land Cruiser advert).
- "Hope you are documenting every prompt, every decision…" Then: "go do it all, and maybe we create a tool."

**Decisions and why:**
- The address is printed as "Amazing Grace, Km 13" everywhere, including the two copies stored in the database (the showroom row and the Help answer), corrected on the live database with audit rows.
- Photo resizing switched to Vercel (`NEXT_PUBLIC_IMAGE_DELIVERY=vercel`) and locked to Sabicars' own Cloudinary account, so nobody can resize other people's pictures on our bill.
- The full-screen hero stays. A framed "whole car" hero was built, shown, and rejected by Alex; the slow zoom and the car reselection were also reverted at his word. Hero cars remain a staff choice in the admin ("Use in the homepage hero").
- The hero video gets its own admin box (Audience → Homepage hero video), YouTube or a video file only; it plays once, muted, then the slideshow returns, as the old site did. After seeing a black box on a slow line, the video layer now shows only while YouTube reports "playing".
- Documentation: no new tool. Git holds the journal and the project book; iCloud holds the raw transcripts; a Claude Code hook insists the day's entry is written.

**Ideas raised (not yet built):**
- Own park footage, 20–40 s, wide, no captions, as the hero video instead of a manufacturer's advert.
- Staff shooting hero cars from further back so the phone crop shows more of the car.

**Rejected or reversed:**
- Framed hero layout (photo in a 4:3 frame, words beside/below): built, screenshotted, rejected; reverted without pushing.
- Reselected six hero cars and two cover-photo reorders: applied to the local database only, then reverted.

**Built and shipped:**
- Address Km 13, "swap and pay the balance (counter balance)" wording, remotePatterns lock (7e4ef51).
- Social links: Instagram @toyotabusesnigeria and TikTok @sabi.cars on Contact, footer and search data (0b2c8b5).
- Rebuild to pick up the photo switch (d7e434e); every live photo now comes through Vercel.
- The 2016 4Runner Limited stays on sale at ₦53m; its hiding rule removed (e04708a).
- Hero kicker "Car dealer in Nigeria"; footer "Run by Sabicars Limited · CAC RC 1560100" (7ede158).
- Admin box for the homepage hero video; plays once then the slideshow returns (6190794).
- Hero video shown only while YouTube says it is playing (6258a19).
- Go-live guide: 20 of 30 tasks ticked with evidence; Vercel, UptimeRobot and photo-switch steps rewritten.
- Project record: this journal, PROJECT-BOOK.md, iCloud backup of transcripts, Stop hook reminder.

**Outage:** 10:45–10:52 Lagos, every database query failed: Supabase's connection pooler (London) refused connections after restarting at 10:42; the database itself never restarted. Not caused by the day's deploys. UptimeRobot, cron-job.org and System status all alerted; nothing was lost. Both errors resolved in the admin.

**Open questions at the end of the day:**
- Delete the ₦36m "2014 Toyota 4Runner" duplicate in the old admin.
- Permission to fix the old site's Instagram link on `main` (four pages still point at @sabicarsltd).
- Supabase Pro / Resend Pro / Drive Plan wording approval: unconfirmed, so unticked in the guide.
- Replace the Toyota advert with Sabicars' own footage.
