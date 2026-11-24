# LJ Healthcare – Daily Work Dashboard

Web app where each staff member logs in and enters their daily work; the Admin sees everything at the end of the day.

**Roles:** Manager · Marketing Manager · Accountant (Ms. Nadeesha) · Accountant (Mr. Krishntha) · Oshani · Admin

## Run
Needs Node.js 22.13+ (no npm install – zero dependencies).

    npm start            # http://localhost:3000

On first run, logins are created with random passwords, printed in the console and saved to `data/initial-passwords.txt`. Change them after login (or reset from Admin → Users).

## Features
- Separate login + dashboard per role (forms, daily lists, tick-lists with special notes).
- Line charts update automatically from entered data (calls/appointments, patient crowd, sales vs expenses, monthly sales comparing this year with the last 3 years, …).
- Admin panel: day summary (who has / hasn't updated, totals, every entry), all charts, user management, CSV export for any date range.
- Pick an earlier date to enter past data (e.g. last 3 years' sales for the comparison chart).

## Customise
Everything each role enters is defined in `config.js` (fields, summaries, charts).

## Deploy notes
Data is stored in `data/lj.db` (SQLite) – back it up. Put it behind HTTPS (cookies become `Secure` automatically with `X-Forwarded-Proto: https` or `COOKIE_SECURE=1`).

## Test
    npm test
