# GitHub Pages Deployment Design: Rack N Roll

## Goal

Publish the existing billiards tournament project at
`https://ridhoihsanii.github.io/racknroll`.

## Chosen approach

Rename the existing public repository from `bilpos-project` to `racknroll`,
preserving its history and repository settings. Keep the existing GitHub Pages
branch deployment from `main` and `/`, which was already configured on the
repository. Keep the existing site files and relative asset references; no
application rewrite or additional build step is required.

## Deployment behavior

GitHub Pages publishes the repository root from `main`; pushing the branding
update to that branch triggers the Pages build. The existing public repository
already exposes its source files, so the branch deployment does not change
their visibility.

The pending `index.html` rebranding requested immediately before this
deployment is part of the site content to publish and must be included in the
release commit.

GitHub Actions was initially considered, but the first workflow run could not
start because GitHub reported an account billing lock. The Actions workflow
was removed and the repository's pre-existing branch-based Pages configuration
was restored instead.

## Alternatives considered

- Create a new `racknroll` repository and copy the project. This produces the
  requested URL but does not preserve the existing repository history and
  settings in the new repository.
- Keep the existing repository name. This avoids a rename, but the Pages URL
  would use `/bilpos-project`, not `/racknroll`.

## Scope and validation

Publishing changes the repository name, keeps Pages on `main`/root, and
includes the already-requested `index.html` branding update in the release.
Validate the Pages build state and confirm the deployed URL responds with the
requested branding.
