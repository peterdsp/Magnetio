# Security Policy

Magnetio is deployed from `main` to production infrastructure controlled by the repository owner.

## Pull requests

All changes to `main` require review by `@peterdsp`.

Do not merge or enable auto-merge for a pull request unless:

- the `validate` check has passed
- the branch is up to date with `main`
- all conversations are resolved
- the diff has been reviewed for secret exposure, deployment risk, and public UI changes
- the production impact is understood

## Secrets

This repository is public. Real secrets must stay only on the production host in `/home/peterdsp/magnetio/.env` and related local env files.

Never commit:

- API keys
- tokens
- passwords
- private URLs
- SSH keys
- production `.env` files

## Production deployment

Production deploys must be approved through the GitHub `production` environment and should run only from protected `main`.
