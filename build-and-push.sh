#!/bin/bash
# Script to build and push SCR-Mesh Docker images

# Set variables
REGISTRY="docker.io"  # Change to your Docker registry if needed
NAMESPACE="your-username"  # Change to your Docker Hub username or organization
FRONTEND_IMAGE="scr-mesh-frontend"
BACKEND_IMAGE="scr-mesh-backend"
VERSION=$(date +%Y%m%d%H%M)  # Use timestamp as version
LATEST="latest"

echo "Building SCR-Mesh Docker images..."

# Build the images using docker-compose
docker-compose build

# Tag the images with version and latest
echo "Tagging images..."
docker tag scr-mesh-frontend:latest ${REGISTRY}/${NAMESPACE}/${FRONTEND_IMAGE}:${VERSION}
docker tag scr-mesh-frontend:latest ${REGISTRY}/${NAMESPACE}/${FRONTEND_IMAGE}:${LATEST}
docker tag scr-mesh-backend:latest ${REGISTRY}/${NAMESPACE}/${BACKEND_IMAGE}:${VERSION}
docker tag scr-mesh-backend:latest ${REGISTRY}/${NAMESPACE}/${BACKEND_IMAGE}:${LATEST}

# Push to registry
echo "Pushing images to registry..."
docker push ${REGISTRY}/${NAMESPACE}/${FRONTEND_IMAGE}:${VERSION}
docker push ${REGISTRY}/${NAMESPACE}/${FRONTEND_IMAGE}:${LATEST}
docker push ${REGISTRY}/${NAMESPACE}/${BACKEND_IMAGE}:${VERSION}
docker push ${REGISTRY}/${NAMESPACE}/${BACKEND_IMAGE}:${LATEST}

echo "Done! Images built and pushed:"
echo "${REGISTRY}/${NAMESPACE}/${FRONTEND_IMAGE}:${VERSION}"
echo "${REGISTRY}/${NAMESPACE}/${FRONTEND_IMAGE}:${LATEST}"
echo "${REGISTRY}/${NAMESPACE}/${BACKEND_IMAGE}:${VERSION}"
echo "${REGISTRY}/${NAMESPACE}/${BACKEND_IMAGE}:${LATEST}" 