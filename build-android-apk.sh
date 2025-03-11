#!/bin/bash

echo "Building Solo Leveling Fitness App for Android..."

# Build the web app
echo "Building web application..."
if ! npm run build; then
    echo "Web build failed!"
    exit 1
fi

# Clean up existing Android setup
echo "Cleaning up existing Android setup..."
rm -rf android/
rm -f capacitor.config.ts capacitor.config.json

# Create Capacitor config
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

# Initialize Capacitor and add Android
echo "Initializing Capacitor..."
npx cap init "Solo Leveling Fitness" com.solofitness.app --web-dir=dist/public
npx cap add android

# Create simple build configuration
echo "Configuring Android build..."
cat > android/app/build.gradle << EOL
apply plugin: 'com.android.application'

android {
    namespace "com.solofitness.app"
    compileSdk 33

    defaultConfig {
        applicationId "com.solofitness.app"
        minSdk 22
        targetSdk 33
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation project(':capacitor-android')
    implementation project(':capacitor-cordova-android-plugins')
    implementation 'androidx.appcompat:appcompat:1.6.1'
}
EOL

# Sync Capacitor
echo "Syncing Capacitor..."
npx cap sync

# Navigate to android directory
cd android

# Build debug APK
echo "Building debug APK..."
chmod +x gradlew
./gradlew assembleDebug --quiet

# Copy the APK
if [ $? -eq 0 ]; then
    echo "Build successful!"
    mkdir -p ../builds
    cp app/build/outputs/apk/debug/app-debug.apk ../builds/
    echo "APK has been copied to the builds directory."
else
    echo "Build failed! Check the error messages above."
    exit 1
fi