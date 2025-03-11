
#!/bin/bash

echo "Building Solo Leveling Fitness App for Android..."

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

echo "Build completed! To create an APK, you need to:"
echo "1. Download the project files"
echo "2. Open the android folder in Android Studio"
echo "3. Run Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo "4. The APK will be generated in android/app/build/outputs/apk/debug/"
