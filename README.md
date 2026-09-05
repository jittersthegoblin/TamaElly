# Elly Pocket Pal

A tiny retro browser pet game starring Elly, a black-and-grey chihuahua.

## What Elly needs

- **Chicken nuggets** — feeding raises fullness and causes a poop a few seconds later.
- **Poop cleanup** — leaving poop around makes her cleanliness fall faster.
- **Play** — raises fun, but makes her tired.
- **Pets** — raises love and happiness.
- **Showers** — restore cleanliness.
- **Sleep** — restores energy over time.
- **Attention** — if important needs are ignored long enough, Elly activates laser eyes.

Elly does not die. She simply becomes increasingly judgmental and armed with lasers.

## Achievements

Version 1.1 adds persistent retro achievements for care milestones, including poop cleanup, showers, nuggets, pets, play sessions, naps, mini-game wins/losses, and surviving laser mode.

## Elly Arcade

Two mini games are built into the pet device:

- **Higher / Lower** — guess whether Elly's next number will be higher or lower.
- **Which Way?** — guess whether Elly will look left or right.

A win uses Elly's happy sprite and gives a little fun/love boost. A loss causes Elly to immediately leave a poop that must be cleaned up.

## Run locally

Open `index.html` in a browser. No build step or server is required.

## GitHub Pages

1. Put all files in a repository while keeping the `assets/` folder next to `index.html`.
2. In GitHub, open **Settings → Pages**.
3. Set the deployment source to your main branch/root folder.
4. GitHub Pages will serve the game as a static site.

## Save data

The game stores Elly's state, statistics, and achievement unlocks in the browser with `localStorage`. Needs continue to drift while the page is closed, capped at six hours of offline decay so she does not become impossibly neglected overnight.

Existing v1.0 save data is migrated automatically by filling in the new stats/achievement fields.

## Art

The included pixel sprites were created specifically for this Elly virtual-pet concept.
