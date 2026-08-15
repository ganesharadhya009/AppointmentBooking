# Auth0 tenant configuration

`tenant.yaml` declares the desired Auth0 tenant state (roles, client
applications) using the [Auth0 Deploy
CLI](https://github.com/auth0/auth0-deploy-cli) format. It is **not applied
automatically** — applying it requires a real Auth0 tenant and Deploy CLI
credentials (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` for a
Deploy CLI application), which must be supplied by whoever runs this.

## Manual apply (run by a human with Auth0 tenant access)

```bash
npx auth0-deploy-cli import --input_file infra/auth0/tenant.yaml
```

## Organizations

Multi-tenant login uses [Auth0
Organizations](https://auth0.com/docs/manage-users/organizations), one
Organization per `Tenant` (Directory API entity). Organization creation is
per-customer and happens at tenant-onboarding time, not here — this file
only declares the tenant-wide roles and client applications shared across
all Organizations.
