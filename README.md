# Driveline Auto / Tacoma Verifier Clean Site

This app is wired to the new Supabase backend:

- URL: `https://fwfsbeeamszwfiwvrfuz.supabase.co`
- Project ID: `fwfsbeeamszwfiwvrfuz`

Copy `.env.example` to `.env.local` and fill in the Supabase anon key, service role key, and Stripe values.

```bash
npm install
npm run dev
```

The SQL migration lives at `../supabase/migrations/001_clean_tacoma_verifier_schema.sql`.
