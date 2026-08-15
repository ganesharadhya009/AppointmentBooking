@description('Short environment name, e.g. dev, staging, prod.')
param environmentName string = 'dev'

@description('Azure region for all resources except the Static Web App.')
param location string = resourceGroup().location

@description('Azure region for the Static Web App (must be one of the supported regions, e.g. eastus2, centralus, westus2, westeurope, eastasia).')
param staticWebAppLocation string = 'eastus2'

@description('Publisher email for API Management notifications. Must be a real, monitored address.')
param apiManagementPublisherEmail string

@description('Administrator login for the Azure SQL logical server.')
param sqlAdminLogin string

@description('Administrator password for the Azure SQL logical server.')
@secure()
param sqlAdminPassword string

@description('Administrator login for the Postgres Flexible Server.')
param postgresAdminLogin string

@description('Administrator password for the Postgres Flexible Server.')
@secure()
param postgresAdminPassword string

var namePrefix = 'appt-${environmentName}'
var uniqueSuffix = uniqueString(resourceGroup().id)

// ---------- Observability ----------

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appinsights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ---------- Secrets ----------

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv-${substring(uniqueSuffix, 0, 6)}'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
  }
}

// ---------- Azure SQL (Directory API, Scheduling API, Client Records API) ----------

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${namePrefix}-sql-${uniqueSuffix}'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
  }
}

resource directoryDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'directory-api'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
}

resource schedulingDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'scheduling-api'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
}

resource clientRecordsDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'client-records-api'
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
}

// ---------- Postgres (AI Service) ----------

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${namePrefix}-ai-pg'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
  }
}

// ---------- Compute (Container Apps for .NET + Python services) ----------

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ---------- Frontend (React Admin SPA) ----------

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-admin-spa'
  location: staticWebAppLocation
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

// ---------- Gateway ----------

resource apiManagement 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: '${namePrefix}-apim-${uniqueSuffix}'
  location: location
  sku: {
    name: 'Developer'
    capacity: 1
  }
  properties: {
    publisherEmail: apiManagementPublisherEmail
    publisherName: 'AppointmentBooking Platform Team'
  }
}

output logAnalyticsWorkspaceId string = logAnalytics.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output containerAppsEnvironmentId string = containerAppsEnv.id
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output apiManagementGatewayUrl string = apiManagement.properties.gatewayUrl
