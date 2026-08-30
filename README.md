# Ninja Online Dice — Backend Setup
1. Create a free Supabase project.
2. In Supabase SQL Editor, run the contents of `supabase-setup.sql`.
3. In Project Settings > API, copy the Project URL and anon/public key.
4. Open `config.js` and replace both placeholder values.
5. Upload ALL files to your GitHub repository, including `verify.html` and `verify.js`.

This version provides:
- Shared last 20 rolls
- Verification page: /verify.html
- Unique roll records in Supabase
- Realtime presence-based active player counter
- Optional privacy/blur overlay

Security note: the included public insert policy is suitable for testing, but for a production "provably fair" system, move roll generation and inserts to a trusted server/Edge Function so clients cannot directly write arbitrary roll records.


## Admin + secure rolls
1. Create an email/password user in Supabase Authentication for yourself.
2. Run `supabase-secure-admin.sql`.
3. Add your user's UUID to `admin_users` using the commented SQL in that file.
4. Upload `admin.html` and `admin.js` to GitHub.
5. The included Edge Function source is the next step for server-side roll creation; do not put a service-role key into GitHub or browser JavaScript.


## VIP Page
Added `vip.html` and `vip.js` for The RuleBreaker VIP design. For secure VIP login, create a Supabase Auth user and use `admin_users`/role checks rather than storing a password in browser JavaScript.


## VIP Login + Multiple VIP Members
1. Run `supabase-vip-members.sql` in the Supabase SQL Editor after `supabase-secure-admin.sql`.
2. Create each VIP player as an email/password user in Supabase Authentication.
3. Sign into `admin.html` (now labelled **VIP LOGIN / VIP CONTROL**) with your authorised control account.
4. Add the VIP user's UUID, display name and unique page slug.
5. Each authorised VIP account can sign into `vip.html` and sees their own personalised VIP name/page.

The VIP member list is stored in `vip_members`; only the authorised control account can add or remove members.
