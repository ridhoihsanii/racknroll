# GitHub Pages Deployment Design: Rack N Roll

## Goal

Publish the existing billiards tournament project at
`https://ridhoihsanii.github.io/racknroll`.

## Chosen approach

Rename the existing public repository from `bilpos-project` to `racknroll`,
preserving its history and repository settings. Configure GitHub Pages to use
GitHub Actions, with a workflow that deploys the repository's static site from
the `main` branch. Keep the existing site files and relative asset references;
no application rewrite or additional build step is required for the static
deployment.

## Deployment behavior

The workflow runs on pushes to `main` and can also be started manually. It
checks out the repository, uploads its static site contents as a Pages
artifact, and deploys that artifact. The artifact contains `index.html`,
`preview.html`, and `assets/`, staged separately so unrelated server, database,
test, and dependency files are not published. It also includes `.nojekyll` so
GitHub Pages serves the static assets directly. GitHub Actions requires the
Pages build and deployment permissions, and Pages must be configured to use
GitHub Actions. A successful deployment makes the site available at the
requested project URL.

## Alternatives considered

- Create a new `racknroll` repository and copy the project. This produces the
  requested URL but does not preserve the existing repository history and
  settings in the new repository.
- Keep the existing repository name. This avoids a rename, but the Pages URL
  would use `/bilpos-project`, not `/racknroll`.

## Scope and validation

Only the repository name and deployment configuration are changed for
publishing. Validate the workflow configuration and confirm the deployed
Pages URL responds after the Actions deployment completes. Existing
application changes are not part of this deployment setup.
