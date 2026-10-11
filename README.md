# Watchdog

**A control room for SPOT, the four-legged inspection robot.** Built at KnightHacks 2026 for the NextEra Energy "SPOT Management Dashboard" challenge.

**Try it online:** https://knight-hacks2026.vercel.app

## What problem does it solve?

Power plants send robots like Boston Dynamics' SPOT on walking routes to read gauges, take heat and sound measurements, and photograph equipment. When a route ends, the robot usually reports one word: "completed". That word hides a lot. A "completed" route can still have skipped stops, readings that can't be trusted, and serious problems with the equipment it looked at.

Watchdog reads everything the robot recorded and tells the person on duty, in plain language:

- what the robot actually found on each route,
- which problems need a human decision first,
- and which patterns repeat across many routes (stops that keep failing, equipment that keeps showing up, settings that work better).

## What you can see

| Screen | What it shows |
|---|---|
| **Live** | A cartoon map of the plant with SPOT walking its route, stop by stop, as it happened. A side panel lists what it is doing and anything that needs attention. You can also try "what if" situations, like a heat wave or a box blocking the charging dock, and check whether today's weather is safe for an outdoor route. |
| **Missions** | Every route the robot walked, with search and filters. Routes marked "completed" that still had problems are flagged. |
| **Mission report** | One route explained: what went wrong, why, how serious it is, and buttons for the operator to choose what to do (send a technician, keep watching, or dismiss). |
| **Equipment page** | The history of one piece of equipment: its readings over time, past problems, and a sample inspection photo. |
| **Insights** | The big picture across all routes: where problems cluster on the map, which stops fail most, how battery level relates to failures, and how two robot software versions compare. |

All plant data is fictional. NextEra Energy supplied it for the hackathon; no real plant, robot or equipment is shown.

## Run it on your own computer

You only need this if you want to run your own copy. The link above works without installing anything.

### 1. Install the tools (once)

- **Node.js** version 20 or newer, from https://nodejs.org (choose the "LTS" download). It includes `npm`, which installs the rest.
- **Git**, from https://git-scm.com, to download the code. (Or skip Git: on the GitHub page click **Code → Download ZIP** and unzip it.)

### 2. Download the code

Open a terminal (on Windows: PowerShell; on Mac: Terminal) and run:

```bash
git clone https://github.com/jbear05/KnightHacks2026.git
cd KnightHacks2026
```

### 3. Start it with the built-in sample data (easiest)

```bash
npm ci
npm run dev
```

The first command downloads what the app needs and takes a few minutes. When the second one prints `Ready`, open **http://localhost:3000** in your browser. To stop it, press `Ctrl + C` in the terminal.

In this mode a yellow "Mock data mode" banner at the top reminds you that you are looking at sample data. Every screen works, but choices you make (like "send a technician") are forgotten when you reload the page.

### 4. Optional: connect it to a real database

This makes the app read from a database and remember the operator's choices. It takes about ten minutes and needs two extra things:

- **A PostgreSQL database.** A free one from https://neon.tech works. Copy its connection link; it starts with `postgresql://`. Team members can use the team's existing Neon database, which already has the data loaded, and skip the `migrate` and `seed` lines below.
- **The challenge data.** NextEra's kit isn't stored in this repository. Put the folder `SPOT_KnightHacks_Challenge_Kit Part One` from the kit inside the `KnightHacks2026` folder.

Start the data server (the "backend") in one terminal:

```bash
cd backend
npm ci
cp .env.example .env
```

On Windows PowerShell use `copy .env.example .env` instead of `cp`. Open the new file `backend/.env` in a text editor and paste your database link after `DATABASE_URL=`. Then:

```bash
npm run migrate
npm run seed -- "../SPOT_KnightHacks_Challenge_Kit Part One/02_DATA"
npm run dev
```

`migrate` creates the tables and `seed` loads the challenge data; you only run them once per database. Leave `npm run dev` running: the backend is now at http://localhost:3001.

In a **second** terminal, from the `KnightHacks2026` folder, point the app at the backend and start it:

```bash
cp .env.example .env.local
npm run dev
```

(Again, `copy` instead of `cp` on Windows.) Open http://localhost:3000. The yellow "Mock data mode" banner is gone, and operator choices now survive a reload. To go back to sample data, delete `.env.local` and restart `npm run dev`.

### If something goes wrong

| What you see | What to do |
|---|---|
| `npm` or `node` is "not recognized" | Node.js isn't installed, or the terminal was open before you installed it. Install it and open a new terminal. |
| Port 3000 or 3001 "already in use" | The app is already running in another terminal. Stop it with `Ctrl + C`, or use the one that is running. |
| Pages show "couldn't load" errors after step 4 | The backend isn't running, or `backend/.env` has the wrong database link. Check the first terminal for an error. |
| `Missing dataset file` when seeding | The challenge folder isn't in the right place, or its name is different. It must be named exactly `SPOT_KnightHacks_Challenge_Kit Part One`. |

## The team

| Role | Person |
|---|---|
| Design & Frontend | Jair Garcia ([@jbear05](https://github.com/jbear05)) |
| Map & Simulation | Ilias Bahau[@IliasCoder](https://github.com/IliasCoder) |
| Backend & Database | Alfredo Cuevas [@FredoC7](https://github.com/FredoC7) |
| Data & AI | Rayan Hannani [@Rayan15-07](https://github.com/Rayan15-07)  |

## Want the technical details?

[ARCHITECTURE.md](ARCHITECTURE.md) explains how the pieces fit together, with a section for each role. The backend has its own guide in [backend/README.md](backend/README.md), and the map engine in [map-sim/README.md](map-sim/README.md).
