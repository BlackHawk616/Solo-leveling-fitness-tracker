#!/bin/bash

echo "Preparing Solo Leveling Fitness App for Android build..."

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

echo "Android project preparation completed!"
echo ""
echo "To build the APK:"
echo "1. Download the 'android' folder from the Replit file explorer"
echo "2. Make sure you have Android Studio installed on your computer"
echo "3. Open the android folder in Android Studio"
echo "4. Wait for the Gradle sync to complete"
echo "5. Click Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo "6. Find the generated APK in android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "For a release build:"
echo "1. Generate a keystore using Android Studio (Build > Generate Signed Bundle / APK)"
echo "2. Follow the wizard to create a new keystore"
echo "3. Build a release APK using the keystore"
echo ""
echo "Note: Building APKs directly in Replit is not supported due to Android SDK requirements."