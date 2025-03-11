#!/bin/bash

echo "Building Solo Leveling Fitness App for Android..."

# Build the web app
if ! npm run build; then
    echo "Web build failed!"
    exit 1
fi

# Initialize Capacitor if not already done
if [ ! -d "android" ]; then
  echo "Initializing Capacitor..."
  npx cap init "Solo Leveling Fitness" com.solofitness.app --web-dir=dist/public
  npx cap add android

  # Configure Java 17 in build.gradle
  echo "Configuring Java toolchain..."
  cat >> android/app/build.gradle << EOL

android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}
EOL
else
  echo "Capacitor already initialized."
fi

# Configure Gradle properties
echo "Configuring Gradle properties..."
cat > android/gradle.properties << EOL
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
android.overridePathCheck=true
EOL

# Sync the web code to the Android project
npx cap sync

echo "Build setup completed! To create an APK:"
echo "1. Push your code to GitHub"
echo "2. The GitHub Actions workflow will automatically build the APK"
echo "3. Download the APK from the Actions tab in your repository"