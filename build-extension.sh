#!/bin/bash
# filepath: build-extension.sh

# Extension build script for Chrome Web Store and Edge Addons
set -e

# Configuration
EXTENSION_NAME="github-hcpterraform-plan-formatter"
BUILD_DIR="build"
DIST_DIR="dist"
VERSION=$(node -p "require('./manifest.json').version" 2>/dev/null || echo "1.0.0")

echo "Building extension: $EXTENSION_NAME v$VERSION"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Copy necessary files
echo "Copying files..."
cp manifest.json "$BUILD_DIR/"
cp content.js "$BUILD_DIR/" 2>/dev/null || true
cp style.css "$BUILD_DIR/" 2>/dev/null || true
cp -r icons/ "$BUILD_DIR/" 2>/dev/null || true
cp -r src/ "$BUILD_DIR/" 2>/dev/null || true
cp -r css/ "$BUILD_DIR/" 2>/dev/null || true
cp -r js/ "$BUILD_DIR/" 2>/dev/null || true
cp README.md "$BUILD_DIR/" 2>/dev/null || true
cp LICENSE "$BUILD_DIR/" 2>/dev/null || true

# Remove development files
echo "Removing development files..."
find "$BUILD_DIR" -name "*.md" -not -name "README.md" -delete 2>/dev/null || true
find "$BUILD_DIR" -name ".git*" -delete 2>/dev/null || true
find "$BUILD_DIR" -name ".DS_Store" -delete 2>/dev/null || true
find "$BUILD_DIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

# Exclude store-assets directory from build
echo "Excluding store assets from build..."
rm -rf "$BUILD_DIR/store-assets" 2>/dev/null || true

# Create ZIP for Chrome Web Store
echo "Creating Chrome Web Store package..."
cd "$BUILD_DIR"
zip -r "../$DIST_DIR/${EXTENSION_NAME}-chrome-v${VERSION}.zip" .
cd ..

# Create ZIP for Edge Addons (same as Chrome)
echo "Creating Edge Addons package..."
cp "$DIST_DIR/${EXTENSION_NAME}-chrome-v${VERSION}.zip" "$DIST_DIR/${EXTENSION_NAME}-edge-v${VERSION}.zip"

echo "Build completed!"
echo "Chrome Web Store: $DIST_DIR/${EXTENSION_NAME}-chrome-v${VERSION}.zip"
echo "Edge Addons: $DIST_DIR/${EXTENSION_NAME}-edge-v${VERSION}.zip"

# Display package info
echo -e "\nPackage information:"
unzip -l "$DIST_DIR/${EXTENSION_NAME}-chrome-v${VERSION}.zip"
