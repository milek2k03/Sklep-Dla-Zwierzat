This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## E-mail marketing

Apply Supabase migrations `029`, `030`, then `031` before enabling campaigns. The Vercel cron calls `/api/cron/marketing` on Thursdays at 10:00 UTC (11:00 or 12:00 in Poland); the application sends only once every four weeks. The campaign uses up to three active, in-stock products and sends only to addresses with an active marketing preference. Each address is claimed once per campaign. Failed or uncertain deliveries are not retried automatically, to avoid duplicates.

Before activation, verify your Resend sending domain and set `CRON_SECRET`, `RESEND_API_KEY`, `STORE_FROM_EMAIL`, production `NEXT_PUBLIC_APP_URL` (HTTPS), `MARKETING_UNSUBSCRIBE_SECRET` (random 32+ characters), and `MARKETING_POSTAL_ADDRESS` (the real sender's postal address) in production. Set `MARKETING_ENABLED=true` only after reviewing a test email and the unsubscribe flow. The default is disabled. The current runner stops if more than 50 active recipients exist; increase capacity with a proper mailing provider/queue before growing beyond that size. Transactional order emails are unaffected.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
