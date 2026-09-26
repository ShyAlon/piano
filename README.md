# Acoustic Piano Trainer

An iPad-focused PWA that listens to an acoustic piano and guides children through familiar tunes.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```

The repository uses `.githooks/pre-push` to run the complete `npm run check` command before every push. Enable the tracked hooks once per clone with:

```bash
git config core.hooksPath .githooks
```

## GitHub Pages deployment

Every push to `main` runs the tests, builds the Vite app with the repository's Pages base path, and deploys `dist` through GitHub Actions.

For the first deployment, open **Settings → Pages** in the GitHub repository and select **GitHub Actions** as the source. Do not select “Deploy from a branch”: that publishes the uncompiled Vite source and causes `/src/main.tsx` and `%BASE_URL%` errors. The deployed URL is reported by the `deploy` job.
