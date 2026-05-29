# Sneakertail AKS Deployment

This folder deploys Sneakertail to Azure Kubernetes Service with Azure Database for PostgreSQL Flexible Server.

The setup is intentionally simple:

- Frontend is exposed with an Azure `LoadBalancer` service.
- Catalog and cart/order services stay private inside the cluster as `ClusterIP` services.
- PostgreSQL runs outside AKS on Azure Database for PostgreSQL Flexible Server.
- The services initialize their own tables on startup, so there is no Kubernetes database init Job.

## 1. Azure Portal Setup

Create these resources from the Azure Portal:

1. Azure Database for PostgreSQL Flexible Server.
2. Database named `sneakertail`.
3. AKS cluster.
4. Link the AKS VNet to the PostgreSQL private DNS zone.

Use the same database behavior as the working Terraform deployment:

- PostgreSQL version: `16`
- Database name: `sneakertail`
- SSL: required
- Private DNS must resolve the PostgreSQL FQDN from AKS.

After AKS is created, connect `kubectl` to the cluster:

```powershell
az aks get-credentials --resource-group <resource-group-name> --name <aks-cluster-name>
kubectl get nodes
```

## 2. Build And Push Images To Docker Hub

If Docker is not installed locally, use the GitHub Actions workflow in `.github/workflows/dockerhub-images.yml`.

Add these GitHub repository secrets:

```text
DOCKERHUB_USERNAME=muhammedsinanust
DOCKERHUB_TOKEN=<docker-hub-access-token>
```

Then run:

```text
GitHub repo -> Actions -> Build and Push Docker Hub Images -> Run workflow
```

To build locally instead, use the commands below.

From the repository root, sign in to Docker Hub:

```powershell
docker login
```

Build the three images:

```powershell
sudo docker build -t muhammedsinanust/sneakertail-frontend:latest -f services/frontend/Dockerfile .
sudo docker build -t muhammedsinanust/sneakertail-catalog-service:latest -f services/catalog-service/Dockerfile .
sudo docker build -t muhammedsinanust/sneakertail-cart-order-service:latest -f services/cart-order-service/Dockerfile .
```

Push the images:

```powershell
sudo docker push muhammedsinanust/sneakertail-frontend:latest
sudo docker push muhammedsinanust/sneakertail-catalog-service:latest
sudo docker push muhammedsinanust/sneakertail-cart-order-service:latest
```

If the Docker Hub repositories are private, create an image pull secret:

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl create secret docker-registry dockerhub-pull-secret `
  --namespace sneakertail `
  --docker-server=https://index.docker.io/v1/ `
  --docker-username=<dockerhub-username> `
  --docker-password=<dockerhub-password-or-token> `
  --docker-email=<email>
```

Then add this block under `spec.template.spec` in each deployment:

```yaml
imagePullSecrets:
  - name: dockerhub-pull-secret
```

For public Docker Hub repositories, skip the image pull secret.

## 3. Create The Database Secret

Copy the example secret:

```powershell
sudo cp k8s/secret.example.yaml k8s/secret.yaml
```

Edit `k8s/secret.yaml` and replace:

- `<postgres-password>`
- `<postgres-fqdn>`

URL-encode the password if it contains special characters. For example, `@` becomes `%40`.

The final value should look like this:

```text
postgres://pgadminuser:<postgres-password>@<postgres-fqdn>:5432/sneakertail?sslmode=require
```

Keep `k8s/secret.yaml` local. Do not commit it.

## 4. Deploy To AKS

Apply the manifests:

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/catalog-deployment.yaml
kubectl apply -f k8s/cart-order-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/services.yaml
```

Watch the rollout:

```powershell
kubectl get pods -n sneakertail -w
```

Check services:

```powershell
kubectl get svc -n sneakertail
```

When the `frontend` service receives an external IP, open:

```text
http://<frontend-external-ip>
```

## 5. Verify The App

Check the frontend:

```powershell
kubectl get svc frontend -n sneakertail
```

Check backend health from inside the cluster:

```powershell
kubectl run curl-test --rm -it --restart=Never --image=curlimages/curl --namespace sneakertail -- http://catalog-service:4001/health
kubectl run curl-test --rm -it --restart=Never --image=curlimages/curl --namespace sneakertail -- http://cart-order-service:4002/health
```

The storefront should load products through the frontend nginx proxy:

- `/catalog-api`
- `/cart-api`

## Troubleshooting

Check pod logs:

```powershell
kubectl logs deployment/catalog-service -n sneakertail
kubectl logs deployment/cart-order-service -n sneakertail
kubectl logs deployment/frontend -n sneakertail
```

If the backend pods restart, check PostgreSQL DNS and network access:

```powershell
kubectl run dns-test --rm -it --restart=Never --image=busybox --namespace sneakertail --command -- nslookup <postgres-fqdn>
```

If DNS does not resolve, confirm the AKS VNet is linked to the PostgreSQL private DNS zone.

If DNS resolves but the app cannot connect, confirm:

- PostgreSQL Flexible Server allows private access from the AKS network path.
- The connection string uses port `5432`.
- The database name is `sneakertail`.
- The connection string includes `sslmode=require`.
- `DB_SSL` is set to `true`.

If images do not pull, confirm the Docker Hub repository names and whether an image pull secret is needed.
