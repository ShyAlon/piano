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

## GitHub Pages deployment

Every push to `main` runs the tests, builds the Vite app with the repository's Pages base path, and deploys `dist` through GitHub Actions.

For the first deployment, open **Settings → Pages** in the GitHub repository and select **GitHub Actions** as the source if it is not already selected. The deployed URL is reported by the `deploy` job.
