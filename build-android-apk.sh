
#!/bin/bash

echo "Building Solo Leveling Fitness App APK..."

# Build the web app
npm run build

# Initialize Capacitor if not already done
if [ ! -d "android" ]; then
  echo "Initializing Capacitor..."
  npx cap init "Solo Leveling Fitness" com.solofitness.app --web-dir=dist/public
  npx cap add android
else
  echo "Capacitor already initialized."
fi

# Sync the web code to the Android project
npx cap sync

echo "Building APK directly..."
cd android

# Create gradle.properties if it doesn't exist
if [ ! -f "gradle.properties" ]; then
  echo "Creating gradle.properties..."
  echo "org.gradle.jvmargs=-Xmx2048m" > gradle.properties
  echo "android.useAndroidX=true" >> gradle.properties
  echo "android.enableJetifier=true" >> gradle.properties
fi

# Execute Gradle build to create APK
./gradlew assembleDebug

echo "APK built successfully!"
echo "APK location: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "To use the APK:"
echo "1. Download the APK file from the file explorer"
echo "2. Transfer it to your Android device"
echo "3. Install and run the app on your device"
