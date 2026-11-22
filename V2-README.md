# B-Will V2 frontend

This branch contains the replacement interface for B-Will's strictly virtual, non-monetary colour game. Game Balance has no cash value.

## Player experience
- Supabase email/password authentication with a one-time signup username
- Interactive three-colour wheel: Green, Orange and Blue
- Two betting slots per player per round
- Seven-second betting phase followed by a three-second reveal phase
- Bet cancellation before betting closes, with full stake return
- Live bets, recent results, and seed commitment verification
- Five-section navigation: Game, History, Balance, Requests, Profile
- Personal bet history and Balance ledger
- Internal Deposit / Withdraw Balance requests with pending withdrawal reservations

## Host experience
- Separate five-section navigation: Dashboard, History, Balances, Requests, Profile
- Minimal live dashboard: current round and phase, active players, betting activity, pending requests
- Historical rounds, bets, Balance ledger and request records
- Player Balance inspection and reason-required Host adjustments
- Host approval/rejection of internal Balance requests

## Backend dependency
The interface uses the V2 Supabase RPCs and the `public.bw_live_bets` view documented in the `Besu-will/b-will-backend` repository.

## Non-monetary operation
Player-facing Deposit and Withdraw labels refer only to internal Game Balance requests. No payment processing, cash deposits, cash payouts, or redeemable value are included.

## Important
This is a development branch and a separate Vercel preview project. It has not been merged into `main` or cut over to the existing V1 experience. Full browser testing and explicit approval are required before any launch.
