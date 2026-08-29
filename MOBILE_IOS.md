# OPEN STARS iOS

This branch is the parallel iOS development track. Production web remains on `main` and continues to use the same Supabase project and accounts.

## Architecture

- React + TypeScript + Vite remains the shared UI/business-logic codebase.
- Capacitor 8 provides the native iOS shell.
- The iOS app embeds the built `dist/` bundle; it does not load the production website as a remote WebView.
- Parent and staff sessions continue to use the existing Supabase backend.
- `/` remains the parent portal and `/admin` remains the staff workspace inside the native shell.

## Current milestone

1. Capacitor iOS shell.
2. Native startup/status-bar integration.
3. Native/deep-link-aware root routing.
4. Xcode project generation and unsigned simulator build in GitHub Actions.

## Next milestones

- Lock the final Apple bundle identifier after App Store Connect setup.
- App icon and launch assets.
- Native camera/photo library integration.
- Push notification device-token registration and Supabase delivery pipeline.
- Notification deep links into homework, grades, comments, news, payments and photo sessions.
- Account deletion/privacy screens required for App Store review.
- TestFlight signing and distribution.

## Local Mac commands

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

The generated `ios/` project is maintained on this branch only until the mobile track is ready to merge safely.
