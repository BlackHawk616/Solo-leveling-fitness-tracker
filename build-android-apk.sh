#!/bin/bash

echo "Building Solo Leveling Fitness App APK..."

# Exit on error
set -e

# Build the web app
echo "Building web application..."
npm run build

# Clean up existing Android setup
echo "Cleaning up existing Android setup..."
rm -rf android/
rm -f capacitor.config.ts

# Set Java environment variables
export JAVA_HOME=/usr/lib/jvm/temurin-17-jdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# Initialize Capacitor
echo "Initializing Capacitor..."
npx cap init "Solo Leveling Fitness" com.solofitness.app --web-dir=dist/public
npx cap add android

# Create builds directory if it doesn't exist
mkdir -p builds

# Configure Gradle properties
echo "Configuring Gradle properties..."
cat > android/gradle.properties << EOL
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
org.gradle.java.home=/usr/lib/jvm/temurin-17-jdk-amd64
EOL

# Sync web code with Android project
echo "Syncing Capacitor..."
npx cap sync

cd android

# Try building debug APK
echo "Building debug APK..."
./gradlew clean assembleDebug --info --stacktrace --scan

# Copy the debug APK to the builds directory
echo "Copying APK to builds directory..."
cp app/build/outputs/apk/debug/app-debug.apk ../builds/

echo "Build completed! Check the builds directory for your APK."