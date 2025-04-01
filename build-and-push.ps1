# PowerShell script to build and push SCR-Mesh Docker images

# Set variables
$REGISTRY = "docker.io"  # Change to your Docker registry if needed
$NAMESPACE = "d1g1talterrain"  # Your Docker Hub username or organization
$FRONTEND_IMAGE = "scr-mesh-frontend"
$BACKEND_IMAGE = "scr-mesh-backend"
$VERSION = Get-Date -Format "yyyyMMddHHmm"  # Use timestamp as version
$LATEST = "latest"

# Check if logged in to Docker Hub - try a simple docker command instead of checking info
Write-Host "Checking Docker Hub login status..." -ForegroundColor Cyan
try {
    # Use a simple command to check if we can access Docker Hub
    $null = docker manifest inspect $REGISTRY/library/hello-world:latest
    Write-Host "Docker Hub login confirmed!" -ForegroundColor Green
} catch {
    Write-Host "You are not logged in to Docker Hub. Please login first:" -ForegroundColor Yellow
    Write-Host "docker login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Building SCR-Mesh Docker images..." -ForegroundColor Cyan

# Build the images using docker-compose
docker-compose build

# Check if build was successful
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed. Please fix the issues and try again." -ForegroundColor Red
    exit 1
}

# Get the image IDs for the freshly built images
$frontendImageId = docker images --format "{{.ID}}" --filter "reference=scropenwisp-frontend"
$backendImageId = docker images --format "{{.ID}}" --filter "reference=scropenwisp-backend"

# If images not found, try alternate names
if (-not $frontendImageId) {
    $frontendImageId = docker images --format "{{.ID}}" --filter "reference=*frontend*" | Select-Object -First 1
}
if (-not $backendImageId) {
    $backendImageId = docker images --format "{{.ID}}" --filter "reference=*backend*" | Select-Object -First 1
}

# Verify we found the images
if (-not $frontendImageId -or -not $backendImageId) {
    Write-Host "Error: Could not find built images. Please check docker images output:" -ForegroundColor Red
    docker images
    exit 1
}

Write-Host "Found frontend image ID: $frontendImageId" -ForegroundColor Cyan
Write-Host "Found backend image ID: $backendImageId" -ForegroundColor Cyan

# Tag the images with version and latest
Write-Host "Tagging images..." -ForegroundColor Cyan
docker tag $frontendImageId "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION"
docker tag $frontendImageId "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST"
docker tag $backendImageId "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION"
docker tag $backendImageId "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST"

# Push to registry
Write-Host "Pushing images to registry..." -ForegroundColor Cyan
docker push "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION"
docker push "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST"
docker push "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION"
docker push "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to push images to Docker Hub. Please check your connection and credentials." -ForegroundColor Red
    exit 1
}

Write-Host "Done! Images built and pushed:" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$VERSION" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$FRONTEND_IMAGE`:$LATEST" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$VERSION" -ForegroundColor Green
Write-Host "$REGISTRY/$NAMESPACE/$BACKEND_IMAGE`:$LATEST" -ForegroundColor Green 