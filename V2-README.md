# B-Will v2 frontend

This branch contains the replacement virtual-coin game interface.

## Features
- Supabase email/password authentication
- Player profile and virtual wallet
- Three equal-probability colours: green, orange and blue
- Two betting slots per player per round
- Server-validated wagers and settlement
- Live bets and recent round results
- SHA-256 server-seed commitment verification
- Host-only virtual coin adjustment tools
- Responsive mobile and desktop layout
- PWA manifest, icon and service worker

## Backend dependency
The interface uses the v2 Supabase RPCs and the `public.bw_live_bets` view documented in the `Besu-will/b-will-backend` repository.

## Important
This is a development branch. It has not been merged into `main` and should not be treated as a production release until full browser testing and an approved cutover are complete.
