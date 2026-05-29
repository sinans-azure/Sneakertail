param(
  [string]$ResourceGroup = "RG-1",
  [string]$Location = "centralindia",
  [string]$EnvironmentName = "cae-sneakertail",
  [string]$InfrastructureSubnetResourceId = "",
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,
  [int]$MinReplicas = 1,
  [int]$MaxReplicas = 3,
  [switch]$CreateFrontDoor,
  [string]$FrontDoorProfileName = "afd-sneakertail",
  [string]$FrontDoorEndpointName = "sneakertail",
  [ValidateSet("Standard_AzureFrontDoor", "Premium_AzureFrontDoor")]
  [string]$FrontDoorSku = "Standard_AzureFrontDoor"
)

$ErrorActionPreference = "Stop"

function Invoke-AzCli {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  Write-Host "Running: az $($Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' ') ..." -ForegroundColor Cyan
  & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed."
  }
}

Invoke-AzCli extension add --name containerapp --upgrade
Invoke-AzCli provider register --namespace Microsoft.App
Invoke-AzCli provider register --namespace Microsoft.OperationalInsights

$envExists = $true
& az containerapp env show --name $EnvironmentName --resource-group $ResourceGroup --only-show-errors 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  $envExists = $false
}

if (-not $envExists) {
  $envArgs = @(
    "containerapp", "env", "create",
    "--name", $EnvironmentName,
    "--resource-group", $ResourceGroup,
    "--location", $Location
  )

  if ($InfrastructureSubnetResourceId) {
    $envArgs += @("--infrastructure-subnet-resource-id", $InfrastructureSubnetResourceId)
  }

  Invoke-AzCli @envArgs
}

Invoke-AzCli containerapp create `
  --name catalog-service `
  --resource-group $ResourceGroup `
  --environment $EnvironmentName `
  --image muhammedsinanust/sneakertail-catalog-service:latest `
  --ingress internal `
  --target-port 4001 `
  --min-replicas $MinReplicas `
  --max-replicas $MaxReplicas `
  --secrets "database-url=$DatabaseUrl" `
  --env-vars NODE_ENV=production PORT=4001 DB_SSL=true DATABASE_URL=secretref:database-url

Invoke-AzCli containerapp create `
  --name cart-order-service `
  --resource-group $ResourceGroup `
  --environment $EnvironmentName `
  --image muhammedsinanust/sneakertail-cart-order-service:latest `
  --ingress internal `
  --target-port 4002 `
  --min-replicas $MinReplicas `
  --max-replicas $MaxReplicas `
  --secrets "database-url=$DatabaseUrl" `
  --env-vars NODE_ENV=production PORT=4002 DB_SSL=true DATABASE_URL=secretref:database-url CATALOG_SERVICE_URL=http://catalog-service

Invoke-AzCli containerapp create `
  --name frontend `
  --resource-group $ResourceGroup `
  --environment $EnvironmentName `
  --image muhammedsinanust/sneakertail-frontend:latest `
  --ingress external `
  --target-port 80 `
  --min-replicas $MinReplicas `
  --max-replicas $MaxReplicas `
  --env-vars CATALOG_API_URL=/catalog-api CART_API_URL=/cart-api CATALOG_PROXY_URL=http://catalog-service CART_PROXY_URL=http://cart-order-service

$frontendFqdn = & az containerapp show `
  --name frontend `
  --resource-group $ResourceGroup `
  --query properties.configuration.ingress.fqdn `
  --output tsv

Write-Host ""
Write-Host "Frontend Container App:" -ForegroundColor Green
Write-Host "https://$frontendFqdn"

if ($CreateFrontDoor) {
  Invoke-AzCli provider register --namespace Microsoft.Cdn

  $originGroupName = "og-sneakertail-frontend"
  $originName = "frontend-container-app"
  $routeName = "route-frontend"

  Invoke-AzCli afd profile create `
    --profile-name $FrontDoorProfileName `
    --resource-group $ResourceGroup `
    --sku $FrontDoorSku

  Invoke-AzCli afd endpoint create `
    --resource-group $ResourceGroup `
    --profile-name $FrontDoorProfileName `
    --endpoint-name $FrontDoorEndpointName `
    --enabled-state Enabled

  Invoke-AzCli afd origin-group create `
    --resource-group $ResourceGroup `
    --profile-name $FrontDoorProfileName `
    --origin-group-name $originGroupName `
    --probe-request-type GET `
    --probe-protocol Https `
    --probe-path / `
    --probe-interval-in-seconds 60 `
    --sample-size 4 `
    --successful-samples-required 3 `
    --additional-latency-in-milliseconds 50

  Invoke-AzCli afd origin create `
    --resource-group $ResourceGroup `
    --profile-name $FrontDoorProfileName `
    --origin-group-name $originGroupName `
    --origin-name $originName `
    --host-name $frontendFqdn `
    --origin-host-header $frontendFqdn `
    --priority 1 `
    --weight 1000 `
    --enabled-state Enabled `
    --http-port 80 `
    --https-port 443

  Invoke-AzCli afd route create `
    --resource-group $ResourceGroup `
    --profile-name $FrontDoorProfileName `
    --endpoint-name $FrontDoorEndpointName `
    --route-name $routeName `
    --origin-group $originGroupName `
    --supported-protocols Http Https `
    --patterns-to-match "/*" `
    --forwarding-protocol MatchRequest `
    --https-redirect Enabled `
    --link-to-default-domain Enabled

  $frontDoorHost = & az afd endpoint show `
    --resource-group $ResourceGroup `
    --profile-name $FrontDoorProfileName `
    --endpoint-name $FrontDoorEndpointName `
    --query hostName `
    --output tsv

  Write-Host ""
  Write-Host "Azure Front Door:" -ForegroundColor Green
  Write-Host "https://$frontDoorHost"
}
