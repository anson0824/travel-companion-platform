# Travel Companion Platform

**Intelligent Travel Companion Matchmaking and Collaborative Itinerary Management Platform**

Node.js + Express + EJS + SQLite MVP. Zero external database setup.

## Quick start

```bash
cd /workspace/travel-companion-platform   # or your project path
npm install
npm start
```

Open **http://localhost:3000** (or the host/port your environment exposes).

The server listens on `process.env.PORT || 3000`.

## Demo accounts

| Role  | Email               | Password   |
|-------|---------------------|------------|
| Admin | `admin@travel.local` | `Admin123!` |
| User  | `demo@travel.local`  | `Demo123!`  |

Extra seed travelers (password `Travel123!`): `maya@travel.local`, `ken@travel.local`.

## Features

- **Account**: register / login (email + password), logout, session auth (bcrypt)
- **Experiences**: list, create, view, edit/delete own posts (title, destination, dates, content, tags)
- **Admin** (role=admin): stats, list users, promote/demote, disable/enable accounts, delete any post
- **Matchmaking**: travel preferences, overlapping destination/date matches, companion requests
- **Collaborative itineraries**: create trips, invite by username/email, shared day items

## Main routes

| Path | Description |
|------|-------------|
| `/` | Landing (or redirect to dashboard if logged in) |
| `/login`, `/register` | Account |
| `POST /logout` | Logout |
| `/dashboard` | Member home |
| `/posts`, `/posts/new`, `/posts/:id` | Experiences CRUD |
| `/admin` | Admin panel |
| `/matchmaking` | Companion matching |
| `/itineraries` | Collaborative trips |

## Deploy (Render / Railway)

1. Connect the repo and set the start command to `npm start`.
2. Environment variables:
   - `PORT` — usually set automatically by the host
   - `NODE_ENV=production`
   - `SESSION_SECRET` — long random string
3. Ensure the app can write a local `data/` directory (SQLite files). On ephemeral disks, data resets on redeploy unless you attach a persistent volume.
4. Optional: `FORCE_SECURE_COOKIE=1` if you terminate TLS and want `Secure` session cookies.

## Stack

- Express, EJS, express-session + connect-sqlite3
- better-sqlite3, bcrypt, method-override
