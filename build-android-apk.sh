#!/bin/bash

echo "Building Solo Leveling Fitness App APK..."

# Build the web app
npm run build

# Initialize Capacitor if not already done
if [ ! -d "android" ]; then
  echo "Initializing Capacitor..."
  npx cap init "Solo Leveling Fitness" com.solofitness.app --web-dir=dist/public
  npx cap add android
fi

# Sync the web code to the Android project
npx cap sync

# Create builds directory if it doesn't exist
mkdir -p builds

# Create a debug keystore for development
if [ ! -f "android/app/debug.keystore" ]; then
  echo "Creating debug keystore..."
  keytool -genkey -v -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
fi

# Set up local.properties
echo "sdk.dir=/usr/local/android-sdk" > android/local.properties

cd android

# Update gradle.properties for memory settings
echo "org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8" > gradle.properties
echo "android.useAndroidX=true" >> gradle.properties
echo "android.enableJetifier=true" >> gradle.properties

# Try building debug APK
./gradlew assembleDebug

# Copy the debug APK to the builds directory
cp app/build/outputs/apk/debug/app-debug.apk ../builds/

echo "Build completed! Check the builds directory for your APK."