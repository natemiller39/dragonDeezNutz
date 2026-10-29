# Dragon Deez Nuts

A cannon-launch game: fire a dragon hauling a sack of nuts across the desert and see how far it goes.

**Play (with leaderboard):** https://dragondeeznuts.onrender.com

**Play (no leaderboard):** https://natemiller39.github.io/dragondeeznutz/

## How to play

- Tap once to lock the cannon angle, tap again to lock the power.
- In the air, hold to fire the jetpack. Run it dry and it has to cool down.
- Springs, boom barrels and balloons send you farther. Cactuses and tar pits end the run.
- Land on critters to squish them: small 50, medium 100, big 200. Chain squishes without touching the ground for combos.
- Touch the ground 3 times without hitting anything to charge Turbo, then hit the TURBO button (or T on a keyboard).

Score is meters traveled plus squish points. Your best score is saved in your browser.

## Running it

The game is a single `index.html`. `server.js` serves it on Render and adds a shared leaderboard at `/api/scores`, stored in Postgres.

- `npm install` then `npm start`
- Set `DATABASE_URL` to a Postgres connection string. The server creates its `dragon_scores` table on startup. Without it, the game still runs and the leaderboard stays hidden.
