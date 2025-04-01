# PowerShell script to build and push SCR-Mesh Docker images

# Set variables
$REGISTRY = "docker.io"  # Change to your Docker registry if needed
$NAMESPACE = "d1g1talterrain"  # Your Docker Hub username or organization
$FRONTEND_IMAGE = "scr-mesh-frontend"
$BACKEND_IMAGE = "scr-mesh-backend"
$VERSION = Get-Date -Format "yyyyMMddHHmm"  # Use timestamp as version
$LATEST = "latest"

Write-Host "Building SCR-Mesh Docker images..." -ForegroundColor Cyan

# Build the images using docker-compose
docker-compose build

# Tag the images with version and latest
Write-Host "Tagging images..." -ForegroundColor Cyan
docker tag scr-mesh-frontend:latest "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION"
docker tag scr-mesh-frontend:latest "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST"
docker tag scr-mesh-backend:latest "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION"
docker tag scr-mesh-backend:latest "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST"

# Push to registry
Write-Host "Pushing images to registry..." -ForegroundColor Cyan
docker push "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION"
docker push "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST"
docker push "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION"
docker push "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST"

Write-Host "Done! Images built and pushed:" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST" -ForegroundColor Green 