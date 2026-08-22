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
