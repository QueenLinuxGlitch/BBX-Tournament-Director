# Beyblade X Tournament Organizer

A static GitHub Pages-compatible tournament organizer for Beyblade X events.

## Features

- Solo blader registration with decklists.
- Team registration with team name, each player, and each player's decklist.
- WBO-style battle setup selections: 1on1 Battle, 3on3 Battle, and Counter Battle.
- Separate Swiss and top-cut format settings.
- Match type selections for 4-point, 5-point, and 7-point matches in each stage.
- Stadium selector with Takara Tomy and Hasbro Beyblade X stadium presets.
- Stage-specific optional rules, including own finish and out-of-bounds finish.
- Battle-by-battle finish tracking with automatic WBO point assignment.
- Swiss first stage pairing with rematch avoidance, byes, live scoring, and standings.
- Standings sorted by match points, Buchholz, battle points, then player name.
- Single elimination top cut seeded from standings.
- Browser local storage with JSON export and import.

## GitHub Pages

Publish the folder as a static site. No build step is required.

1. Push `index.html`, `styles.css`, and `app.js` to a GitHub repository.
2. In repository settings, enable Pages for the branch and folder that contain the files.
3. Open the Pages URL.

## Rule Reference

The rules panel summarizes current WBO Beyblade X battle and match terminology: 1on1 Battle, 3on3 Battle, Counter Battle, and 4-point, 5-point, and 7-point matches. Confirm official WBO event requirements before using this for ranked events.
