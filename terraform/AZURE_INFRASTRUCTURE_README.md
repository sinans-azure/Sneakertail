# Sneakertail Azure Infrastructure README

This document explains the complete Azure infrastructure for the Sneakertail demo: the objective, network layout, security model, routing behavior, resource names, IP ranges, and how requests move through the system.

Sensitive values such as VM passwords and PostgreSQL passwords are intentionally not included here. They are supplied through Terraform variables and should be treated as secrets.

## Problem Statement / Objective For Slides

Sneakertail demonstrates how to deploy a small e-commerce application on Azure using segmented networking, private backend services, a public Application Gateway, path-based routing, host-name based routing, private database access, autoscaling frontend compute, and a controlled management entry point.

The main objective is to show how a public web application can expose only one controlled internet-facing entry point while keeping application services, documentation services, and the database private inside Azure virtual networks.

What this demo demonstrates:

- Hub-and-spoke style networking using multiple VNets.
- A public Azure Application Gateway with WAF as the main ingress point.
- Path-based routing for API traffic:
  - `/catalog-api/*` goes to the Catalog backend VM.
  - `/cart-api/*` goes to the Cart backend VM.
  - `/` goes to the frontend VM Scale Set.
- Host-name based routing:
  - `docs.sneakertail.online` goes to a private Docs VM through a dedicated Application Gateway listener.
- Private PostgreSQL Flexible Server with public network access disabled.
- Backend services connecting privately to PostgreSQL through VNet peering and Private DNS.
- A frontend VM Scale Set with autoscaling.
- A bastion/jump VM for administrative access.
- Network Security Groups that restrict direct access to private workloads.

## High-Level Architecture

```text
Internet
   |
   | HTTP :80
   v
PIP-1 / Application Gateway Public IP
20.235.193.1
   |
   v
AGW-1 + WAF-1 in VNET-1 / SNET-1
   |
   |-- Path: /                  -> VMSS-1 frontend instances in VNET-2 / SNET-3
   |-- Path: /catalog-api/*     -> VM-1 Catalog API at 10.1.2.5:4001
   |-- Path: /cart-api/*        -> VM-2 Cart API at 10.1.2.4:4002
   |-- Host: docs.sneakertail.online -> VM-Docs at 10.3.1.4:80

Admin
   |
   | SSH
   v
PIP-Bastion / VM-Bastion
98.70.120.218 -> 10.0.2.4

Backend services
   |
   | Private PostgreSQL traffic
   v
psql-sneakertail-1.postgres.database.azure.com
Private PostgreSQL Flexible Server in delegated subnet SNET-5
```

## Current Terraform Output Values

These values came from the current local Terraform state using `terraform output`.

| Output | Value |
|---|---|
| Application Gateway public IP | `20.235.193.1` |
| Application Gateway DNS hint | Create DNS A/CNAME records to `20.235.193.1` |
| Bastion public IP | `98.70.120.218` |
| Bastion private IP | `10.0.2.4` |
| Catalog private IP | `10.1.2.5` |
| Cart private IP | `10.1.2.4` |
| Docs private IP | `10.3.1.4` |
| PostgreSQL FQDN | `psql-sneakertail-1.postgres.database.azure.com` |
| Docs URL | `http://docs.sneakertail.online` through Application Gateway |

Because several NICs use dynamic private IP allocation, verify the latest values with:

```powershell
terraform output
```

## Deployment Scope

| Setting | Value |
|---|---|
| Resource group | `RG-1` |
| Azure region | `Central India` |
| Name prefix | `sneakertail` |
| Repository | `https://github.com/sinans-azure/Sneakertail.git` |
| Branch | `main` |
| Default admin username | `azureuser` |
| Backend VM size | `Standard_D2als_v6` |
| Frontend VMSS size | `Standard_D2als_v6` |
| Bastion VM size | `Standard_D2als_v6` |
| Docs VM size | `Standard_D2als_v6` |
| Frontend desired instances | `1` |
| Frontend autoscale min | `1` |
| Frontend autoscale max | `5` |
| Docs host name | `docs.sneakertail.online` |

## Network Design

The deployment uses four VNets:

| VNet | Name | CIDR | Purpose |
|---|---|---|---|
| Hub VNet | `VNET-1` | `10.0.0.0/16` | Shared ingress and management network. Contains Application Gateway and Bastion VM. |
| App VNet | `VNET-2` | `10.1.0.0/16` | Application workload network. Contains frontend and backend services. |
| Data VNet | `VNET-3` | `10.2.0.0/16` | Data network. Contains delegated PostgreSQL subnet. |
| Docs VNet | `VNET-4` | `10.3.0.0/16` | Documentation workload network. Contains private Docs VM. |

## Subnets

| Subnet | Name | VNet | CIDR | Purpose |
|---|---|---|---|---|
| Application Gateway subnet | `SNET-1` | `VNET-1` | `10.0.1.0/24` | Hosts `AGW-1`. |
| Bastion subnet | `SNET-2` | `VNET-1` | `10.0.2.0/24` | Hosts `VM-Bastion`. |
| Frontend subnet | `SNET-3` | `VNET-2` | `10.1.1.0/24` | Hosts frontend VMSS instances. |
| Backend subnet | `SNET-4` | `VNET-2` | `10.1.2.0/24` | Hosts Catalog and Cart backend VMs. |
| PostgreSQL subnet | `SNET-5` | `VNET-3` | `10.2.1.0/24` | Delegated to PostgreSQL Flexible Server. |
| Docs subnet | `SNET-6` | `VNET-4` | `10.3.1.0/24` | Hosts private Docs VM. |

## VNet Peering

| Peering | Direction | Purpose |
|---|---|---|
| `PEER-1` | `VNET-1` hub -> `VNET-2` app | Lets Application Gateway in the hub reach frontend/backend services. |
| `PEER-2` | `VNET-2` app -> `VNET-1` hub | Return path from app workloads to hub. |
| `PEER-3` | `VNET-2` app -> `VNET-3` data | Lets backend services reach PostgreSQL private endpoint/delegated subnet path. |
| `PEER-4` | `VNET-3` data -> `VNET-2` app | Return path between data and app networks. |
| `PEER-5` | `VNET-1` hub -> `VNET-4` docs | Lets Application Gateway reach Docs VM privately. |
| `PEER-6` | `VNET-4` docs -> `VNET-1` hub | Return path from Docs VM to Application Gateway. |

## Application Gateway And Routing

### Public Entry Point

| Resource | Name | Details |
|---|---|---|
| Public IP | `PIP-1` | Static Standard public IP, zones `1`, `2`, `3`. Current IP: `20.235.193.1`. |
| Application Gateway | `AGW-1` | WAF_v2 tier, capacity `2`. |
| WAF Policy | `WAF-1` | OWASP `3.2`, Detection mode. |
| Frontend IP config | `public-frontend-ip` | Uses `PIP-1`. |
| Frontend port | `port-80` | HTTP port `80`. |
| Gateway subnet | `SNET-1` | `10.0.1.0/24`. |

### WAF Policy

`WAF-1` is attached to `AGW-1`.

| Setting | Value |
|---|---|
| Enabled | `true` |
| Mode | `Detection` |
| Request body check | `true` |
| File upload limit | `100 MB` |
| Max request body size | `128 KB` |
| Managed rules | OWASP `3.2` |

Detection mode means WAF observes and logs rule matches without blocking them. This is useful for demos and tuning before switching to prevention mode.

### Backend Pools

| Pool | Backend |
|---|---|
| `pool-frontend` | Frontend VM Scale Set instances register themselves through the VMSS Application Gateway backend pool association. |
| `pool-catalog` | Catalog private IP: `10.1.2.5`. |
| `pool-cart` | Cart private IP: `10.1.2.4`. |
| `pool-docs` | Docs private IP: `10.3.1.4`. |

### Health Probes

| Probe | Protocol | Host | Path | Interval | Timeout | Unhealthy threshold |
|---|---|---|---|---|---|---|
| `probe-frontend` | HTTP | `127.0.0.1` | `/` | `30s` | `10s` | `3` |
| `probe-catalog` | HTTP | Catalog private IP | `/health` | `30s` | `10s` | `3` |
| `probe-cart` | HTTP | Cart private IP | `/health` | `30s` | `10s` | `3` |
| `probe-docs` | HTTP | `docs.sneakertail.online` | `/` | `30s` | `10s` | `3` |

### HTTP Settings

| HTTP setting | Port | Protocol | Probe | Notes |
|---|---|---|---|---|
| `http-frontend` | `80` | HTTP | `probe-frontend` | Used for store UI. |
| `http-catalog` | `4001` | HTTP | `probe-catalog` | Used for Catalog API. |
| `http-cart` | `4002` | HTTP | `probe-cart` | Used for Cart/Auth API. |
| `http-docs` | `80` | HTTP | `probe-docs` | Uses host name `docs.sneakertail.online`. |

### Listeners

| Listener | Host name | Port | Purpose |
|---|---|---|---|
| `listener-path-demo` | Any/default host | `80` | Main path-based demo listener. |
| `listener-docs-host` | `docs.sneakertail.online` | `80` | Host-name based docs listener. |

### Routing Rules

| Rule | Type | Priority | Listener | Destination |
|---|---|---|---|---|
| `rule-docs-host` | Basic | `90` | `listener-docs-host` | Sends `docs.sneakertail.online` to `pool-docs` using `http-docs`. |
| `rule-path-demo` | PathBasedRouting | `100` | `listener-path-demo` | Uses `pathmap-sneakertail`. |

The docs rule has a higher priority because lower priority numbers are evaluated first. When the host header is `docs.sneakertail.online`, the dedicated docs listener/rule handles it.

### Path Map

`pathmap-sneakertail`:

| Path | Backend pool | HTTP setting | Result |
|---|---|---|---|
| `/catalog-api/*` | `pool-catalog` | `http-catalog` | Routes to Catalog API on port `4001`. |
| `/cart-api/*` | `pool-cart` | `http-cart` | Routes to Cart/Auth API on port `4002`. |
| Default `/` | `pool-frontend` | `http-frontend` | Routes to frontend VMSS on port `80`. |

## DNS / Hostname Setup

For the demo, public DNS should point to the Application Gateway public IP.

| Hostname | DNS target |
|---|---|
| `sneakertail.online` or main demo hostname | `20.235.193.1` |
| `www.sneakertail.online` if used | `20.235.193.1` |
| `docs.sneakertail.online` | `20.235.193.1` |

The important point is that both the main app and docs hostnames resolve to the same Application Gateway public IP. The Application Gateway then decides where to send traffic based on path or host header.

## Compute Resources

### Frontend

| Item | Value |
|---|---|
| Resource | Azure Linux Virtual Machine Scale Set |
| Name | `VMSS-1` |
| VNet/subnet | `VNET-2` / `SNET-3` |
| Subnet CIDR | `10.1.1.0/24` |
| VM size | `Standard_D2als_v6` |
| Current desired instances | `1` |
| Autoscale min/max | `1` / `5` |
| OS image | Ubuntu Server 22.04 LTS Gen2 |
| Upgrade mode | Automatic |
| Public IP | None on VMSS instances |
| Ingress | Application Gateway backend pool `pool-frontend` |
| Service port | `80` |

The frontend VMSS installs Nginx and serves the frontend app. It uses `/catalog-api` and `/cart-api` as API paths, so browser requests stay on the same public Application Gateway endpoint.

### Frontend Autoscale

| Setting | Scale out | Scale in |
|---|---|---|
| Autoscale setting name | `AS-1` | `AS-1` |
| Metric | `Percentage CPU` | `Percentage CPU` |
| Operator | GreaterThan | LessThan |
| Threshold | `70` | `30` |
| Time window | `PT10M` | `PT15M` |
| Action | Increase by `1` | Decrease by `1` |
| Cooldown | `PT5M` | `PT10M` |

### Backend: Catalog API

| Item | Value |
|---|---|
| VM name | `VM-1` |
| NIC | `NIC-1` |
| Current private IP | `10.1.2.5` |
| VNet/subnet | `VNET-2` / `SNET-4` |
| Subnet CIDR | `10.1.2.0/24` |
| VM size | `Standard_D2als_v6` |
| OS image | Ubuntu Server 22.04 LTS Gen2 |
| Public IP | None |
| Service port | `4001` |
| Health path | `/health` |
| Application Gateway pool | `pool-catalog` |

The Catalog API connects to PostgreSQL using the private PostgreSQL FQDN and database credentials passed through cloud-init.

### Backend: Cart/Auth API

| Item | Value |
|---|---|
| VM name | `VM-2` |
| NIC | `NIC-2` |
| Current private IP | `10.1.2.4` |
| VNet/subnet | `VNET-2` / `SNET-4` |
| Subnet CIDR | `10.1.2.0/24` |
| VM size | `Standard_D2als_v6` |
| OS image | Ubuntu Server 22.04 LTS Gen2 |
| Public IP | None |
| Service port | `4002` |
| Health path | `/health` |
| Application Gateway pool | `pool-cart` |

The Cart/Auth API connects to PostgreSQL and calls the Catalog API privately at `http://10.1.2.5:4001`.

### Docs VM

| Item | Value |
|---|---|
| VM name | `VM-Docs` |
| NIC | `NIC-Docs` |
| Current private IP | `10.3.1.4` |
| VNet/subnet | `VNET-4` / `SNET-6` |
| Subnet CIDR | `10.3.1.0/24` |
| VM size | `Standard_D2als_v6` |
| OS image | Ubuntu Server 22.04 LTS Gen2 |
| Public IP | None |
| Service port | `80` |
| Hostname route | `docs.sneakertail.online` |
| Application Gateway pool | `pool-docs` |

The Docs VM is not directly reachable from the internet. Users reach it through the Application Gateway public IP and the `docs.sneakertail.online` host-name listener.

### Bastion / Jump VM

| Item | Value |
|---|---|
| VM name | `VM-Bastion` |
| NIC | `NIC-Bastion` |
| Public IP resource | `PIP-Bastion` |
| Current public IP | `98.70.120.218` |
| Current private IP | `10.0.2.4` |
| VNet/subnet | `VNET-1` / `SNET-2` |
| Subnet CIDR | `10.0.2.0/24` |
| VM size | `Standard_D2als_v6` |
| OS image | Ubuntu Server 22.04 LTS Gen2 |
| Admin username | `azureuser` |

The Bastion VM is the management jump point. From it, you can SSH into private VMs using their private IP addresses, subject to NSG rules.

Example:

```powershell
ssh azureuser@98.70.120.218
```

Then from the bastion session:

```bash
ssh azureuser@10.1.2.5   # Catalog VM
ssh azureuser@10.1.2.4   # Cart VM
ssh azureuser@10.3.1.4   # Docs VM
```

## Database Layer

| Item | Value |
|---|---|
| Service | Azure Database for PostgreSQL Flexible Server |
| Server name | `psql-sneakertail-1` |
| FQDN | `psql-sneakertail-1.postgres.database.azure.com` |
| Database name | `sneakertail` |
| PostgreSQL version | `16` |
| SKU | `B_Standard_B1ms` |
| Storage | `32768 MB` |
| Public network access | Disabled |
| Delegated subnet | `SNET-5` |
| Delegated subnet CIDR | `10.2.1.0/24` |
| Private DNS zone | `sneakertail.private.postgres.database.azure.com` |
| Admin username | `pgadminuser` |

The PostgreSQL subnet has:

- Service endpoint: `Microsoft.Storage`
- Delegation: `Microsoft.DBforPostgreSQL/flexibleServers`
- Delegation action: `Microsoft.Network/virtualNetworks/subnets/join/action`

### Private DNS

| Resource | Name | Purpose |
|---|---|---|
| Private DNS zone | `sneakertail.private.postgres.database.azure.com` | Private name resolution for PostgreSQL Flexible Server. |
| VNet link | `PDNS-LINK-1` | Links the private DNS zone to App VNet `VNET-2`. |
| VNet link | `PDNS-LINK-2` | Links the private DNS zone to Data VNet `VNET-3`. |

The app VNet link matters because backend VMs live in `VNET-2` and need to resolve the PostgreSQL private FQDN.

## Security Model

### Publicly Exposed Resources

| Resource | Public exposure | Purpose |
|---|---|---|
| `PIP-1` / `AGW-1` | HTTP `80` | Public application entry point. |
| `PIP-Bastion` / `VM-Bastion` | SSH `22`, RDP `3389` in current NSG | Administrative jump host. |

Everything else is private.

### Private Resources

| Resource | Private only? | Notes |
|---|---|---|
| Frontend VMSS | Yes | Reached through Application Gateway backend pool. |
| Catalog VM | Yes | Reached by Application Gateway on port `4001`. |
| Cart VM | Yes | Reached by Application Gateway on port `4002`. |
| Docs VM | Yes | Reached by Application Gateway on port `80`. |
| PostgreSQL | Yes | Public network access disabled. |

### NSG: Backend `NSG-1`

Associated with:

- `NIC-1` for Catalog VM.
- `NIC-2` for Cart VM.

Rules:

| Rule | Priority | Direction | Port | Source | Purpose |
|---|---|---|---|---|---|
| `AllowAppGatewayToCatalog` | `100` | Inbound | `4001` | `10.0.1.0/24` | Allows App Gateway subnet to reach Catalog API. |
| `AllowAppGatewayToCart` | `110` | Inbound | `4002` | `10.0.1.0/24` | Allows App Gateway subnet to reach Cart API. |
| `AllowSshFromPrivateNetworks` | `120` | Inbound | `22` | `VirtualNetwork` | Allows private SSH from peered/private networks. |

### NSG: Frontend `NSG-2`

Associated with:

- Frontend subnet `SNET-3`.

Rules:

| Rule | Priority | Direction | Port | Source | Purpose |
|---|---|---|---|---|---|
| `AllowAppGatewayHttp` | `100` | Inbound | `80` | `10.0.1.0/24` | Allows App Gateway to reach frontend instances. |
| `AllowSshFromPrivateNetworks` | `110` | Inbound | `22` | `VirtualNetwork` | Allows private SSH from peered/private networks. |

### NSG: Docs `NSG-Docs`

Associated with:

- `NIC-Docs`.

Rules:

| Rule | Priority | Direction | Port | Source | Purpose |
|---|---|---|---|---|---|
| `AllowHttpFromApplicationGateway` | `100` | Inbound | `80` | `10.0.1.0/24` | Allows only the App Gateway subnet to reach the Docs web server. |
| `AllowSSHFromBastionSubnet` | `110` | Inbound | `22` | `10.0.2.0/24` | Allows SSH only from the Bastion subnet. |

### NSG: Bastion `NSG-Bastion`

Associated with:

- `NIC-Bastion`.

Rules:

| Rule | Priority | Direction | Port | Source/Destination | Purpose |
|---|---|---|---|---|---|
| `AllowRDPFromInternet` | `100` | Inbound | `3389` | Source `*` | Allows RDP from internet. Current VM is Linux, so this is likely not needed. |
| `AllowSSHFromInternet` | `110` | Inbound | `22` | Source `*` | Allows SSH from internet for management. |
| `AllowOutboundToVirtualNetwork` | `100` | Outbound | `*` | Destination `VirtualNetwork` | Allows bastion to reach private workloads. |

Security note: for a production design, SSH should be restricted to a trusted admin IP range or replaced with Azure Bastion/Just-in-Time access. RDP should be removed for a Linux jump VM unless there is a specific reason to keep it.

## End-To-End Request Flows

### Main Store Page

```text
User browser
  -> http://sneakertail.online or http://20.235.193.1
  -> PIP-1
  -> AGW-1 listener-path-demo
  -> rule-path-demo
  -> pathmap-sneakertail default route
  -> pool-frontend
  -> VMSS-1 frontend instance on port 80
```

The frontend serves HTML, CSS, and JavaScript through Nginx.

### Catalog API Request

```text
Browser requests /catalog-api/*
  -> AGW-1 listener-path-demo
  -> rule-path-demo
  -> pathmap-sneakertail path rule catalog-api
  -> pool-catalog
  -> VM-1 at 10.1.2.5:4001
  -> PostgreSQL private FQDN if product data is needed
```

### Cart/Auth API Request

```text
Browser requests /cart-api/*
  -> AGW-1 listener-path-demo
  -> rule-path-demo
  -> pathmap-sneakertail path rule cart-api
  -> pool-cart
  -> VM-2 at 10.1.2.4:4002
  -> PostgreSQL private FQDN for cart/user/order data
  -> Catalog API private IP if product lookup is needed
```

### Docs Hostname Request

```text
Browser requests http://docs.sneakertail.online
  -> DNS resolves docs.sneakertail.online to 20.235.193.1
  -> AGW-1 listener-docs-host sees host header docs.sneakertail.online
  -> rule-docs-host
  -> pool-docs
  -> VM-Docs at 10.3.1.4:80
```

The Docs VM has no public IP. The traffic path from Application Gateway to Docs VM works because:

- Application Gateway is in Hub VNet `VNET-1`.
- Docs VM is in Docs VNet `VNET-4`.
- `PEER-5` connects hub to docs.
- `PEER-6` connects docs back to hub.
- `NSG-Docs` allows HTTP from `10.0.1.0/24`, the App Gateway subnet.

### Backend To Database

```text
VM-1 or VM-2
  -> resolves psql-sneakertail-1.postgres.database.azure.com
  -> Private DNS zone/link resolves to private PostgreSQL endpoint
  -> traffic crosses app/data peering
  -> PostgreSQL Flexible Server in delegated SNET-5
```

PostgreSQL public access is disabled, so database access is private to the Azure network path.

## Why This Design Matters

The design separates public ingress, application workloads, data workloads, documentation workload, and management access.

- The internet does not talk directly to backend VMs.
- The internet does not talk directly to the Docs VM.
- The internet does not talk directly to PostgreSQL.
- Application Gateway becomes the single public web entry point.
- WAF sits at the edge before requests reach workloads.
- Private DNS and VNet peering allow services to communicate without public IPs.
- Autoscale allows the frontend tier to grow from `1` to `5` instances based on CPU.
- Host-name based routing proves that multiple experiences can share one Application Gateway public IP.

## Resource Inventory

| Category | Resource name |
|---|---|
| Resource group | `RG-1` |
| Hub VNet | `VNET-1` |
| App VNet | `VNET-2` |
| Data VNet | `VNET-3` |
| Docs VNet | `VNET-4` |
| App Gateway subnet | `SNET-1` |
| Bastion subnet | `SNET-2` |
| Frontend subnet | `SNET-3` |
| Backend subnet | `SNET-4` |
| PostgreSQL subnet | `SNET-5` |
| Docs subnet | `SNET-6` |
| VNet peerings | `PEER-1` through `PEER-6` |
| Application Gateway public IP | `PIP-1` |
| Application Gateway | `AGW-1` |
| WAF policy | `WAF-1` |
| Frontend VMSS | `VMSS-1` |
| Frontend autoscale | `AS-1` |
| Catalog VM | `VM-1` |
| Catalog NIC | `NIC-1` |
| Cart VM | `VM-2` |
| Cart NIC | `NIC-2` |
| Backend NSG | `NSG-1` |
| Frontend NSG | `NSG-2` |
| Bastion VM | `VM-Bastion` |
| Bastion NIC | `NIC-Bastion` |
| Bastion public IP | `PIP-Bastion` |
| Bastion NSG | `NSG-Bastion` |
| Docs VM | `VM-Docs` |
| Docs NIC | `NIC-Docs` |
| Docs NSG | `NSG-Docs` |
| PostgreSQL server | `psql-sneakertail-1` |
| PostgreSQL database | `sneakertail` |
| PostgreSQL private DNS zone | `sneakertail.private.postgres.database.azure.com` |
| Private DNS links | `PDNS-LINK-1`, `PDNS-LINK-2` |

## Slide-Friendly Summary

This project deploys Sneakertail as a secure, segmented Azure e-commerce architecture. A single public Application Gateway with WAF receives all web traffic and routes it either by URL path to frontend/catalog/cart services or by host name to a private documentation site. The backend APIs, docs VM, frontend instances, and PostgreSQL database do not expose public IPs, except for the dedicated bastion jump host used for administration. VNet peering, NSG rules, and Private DNS provide controlled private connectivity between the hub, app, data, and docs networks.

In one line:

> Sneakertail demonstrates secure Azure ingress, private service networking, path-based routing, host-name based routing, autoscaling compute, and private database connectivity for a realistic e-commerce workload.
