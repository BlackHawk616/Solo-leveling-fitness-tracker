#!/bin/bash

echo "Building Solo Leveling Fitness App for Android..."

# Exit on error
set -e

# Build the web app
echo "Building web application..."
npm run build

# Clean up existing Android setup
echo "Cleaning up existing Android setup..."
rm -rf android/
rm -f capacitor.config.ts capacitor.config.json

# Create minimal Capacitor config
echo "Creating Capacitor configuration..."
cat > capacitor.config.json << EOL
{
  "appId": "com.solofitness.app",
  "appName": "Solo Leveling Fitness",
  "webDir": "dist/public",
  "server": {
    "androidScheme": "https"
  }
}
EOL

# Configure Java 17 environment
export JAVA_HOME=/usr/lib/jvm/temurin-17-jdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# Initialize Capacitor
echo "Initializing Capacitor..."
npx cap add android

# Configure Java version in Gradle
echo "Configuring Gradle properties..."
cat > android/gradle.properties << EOL
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
android.overridePathCheck=true
org.gradle.java.home=/usr/lib/jvm/temurin-17-jdk-amd64
EOL

# Sync web code with Android project
echo "Syncing Capacitor..."
npx cap sync

# Navigate to android directory
cd android

# Make gradlew executable
echo "Making gradlew executable..."
chmod +x gradlew

# Build debug APK
echo "Building debug APK..."
./gradlew clean assembleDebug --info --stacktrace --scan > ../android-build.log 2>&1

# Check build status
if [ $? -eq 0 ]; then
    echo "Build successful! Creating builds directory..."
    mkdir -p ../builds
    cp app/build/outputs/apk/debug/app-debug.apk ../builds/
    echo "APK has been copied to the builds directory."
else
    echo "Build failed! Check android-build.log for details."
    tail -n 50 ../android-build.log
    exit 1
fi