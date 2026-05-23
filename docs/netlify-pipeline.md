# Netlify Deployment Pipeline

The GitHub Actions workflow at `.github/workflows/netlify.yml` deploys NPV Lab to Netlify.

## Triggers

- Pull requests targeting `main` run tests, build the app, and create a Netlify preview deploy.
- Pushes to `main` run tests, build the app, and deploy production to the existing `npv-lab` Netlify site.

The previous GitHub Pages workflow is manual-only so production deploys do not split across two hosts.

## Required GitHub Secret

Add one repository secret:

```text
NETLIFY_AUTH_TOKEN
```

Create it in Netlify:

1. Open Netlify user settings.
2. Go to Applications.
3. Create a personal access token.

Add it in GitHub:

1. Open `armstrma/npv-calculator` on GitHub.
2. Go to Settings -> Secrets and variables -> Actions.
3. Create repository secret `NETLIFY_AUTH_TOKEN`.

The Netlify site id and Supabase publishable values are already in the workflow. They are not private secrets.
