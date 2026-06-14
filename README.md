# Jbling Hospital Release Tracker

Tracks enemy hospital timers during Ranked Wars.

## Features

- Enemy-only tracking
- Shows next 10 hospital releases
- Sorts by release time
- Highlights the next target out
- Click 👤 to open profile
- Click 📋 to copy profile link
- Draggable tracker window
- Profile caching for fast updates
- Works directly from Ranked War page

## Usage

Open a Ranked War.

The tracker will:

1. Scan enemy hospital players.
2. Collect hospital release times.
3. Display the next 10 releases.
4. Update automatically.

## Notes

The first scan may take approximately 30 seconds because the script gathers hospital release times from enemy profile pages.

After the initial scan, updates are much faster thanks to caching.

## Installation

Requires Tampermonkey.

Install from:

https://raw.githubusercontent.com/jadams413/Torn/main/jbling-hospital-tracker.user.js
