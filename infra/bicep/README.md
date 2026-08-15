# Azure infrastructure

`main.bicep` declares the Phase 1 Azure resources. It is validated with
`az bicep build` in CI/CD but is **not deployed automatically** — deployment
requires an authenticated Azure subscription and real admin credentials for
SQL/Postgres, which must be supplied by whoever runs this.

## Manual deploy (run by a human with subscription access)

```bash
az login
az group create --name appt-dev-rg --location <your-region>
az deployment group create \
  --resource-group appt-dev-rg \
  --template-file infra/bicep/main.bicep \
  --parameters environmentName=dev apiManagementPublisherEmail=<real-email> sqlAdminLogin=<login> sqlAdminPassword=<password> postgresAdminLogin=<login> postgresAdminPassword=<password>
```

Store `sqlAdminPassword` and `postgresAdminPassword` in a secrets manager
(e.g. `az keyvault secret set`) rather than passing them on the command line
in a real deployment — the command above is illustrative.
