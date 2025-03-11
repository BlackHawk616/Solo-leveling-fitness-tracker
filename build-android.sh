#!/bin/bash

echo "Building Solo Leveling Fitness App for Android..."

# Check Java version and installation
echo "Checking Java installation..."
if ! command -v java &> /dev/null; then
    echo "Error: Java is not installed"
    exit 1
fi

java -version
echo "JAVA_HOME=$JAVA_HOME"

# Build the web app
if ! npm run build; then
    echo "Web build failed! Check the build output above for details."
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

# Configure Gradle properties with Java path detection
echo "Configuring Gradle properties..."
JAVA_PATH=$(dirname $(dirname $(readlink -f $(which java))))
echo "Detected Java path: $JAVA_PATH"

cat > android/gradle.properties << EOL
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
android.overridePathCheck=true
org.gradle.java.home=$JAVA_PATH
EOL

# Sync the web code to the Android project
npx cap sync

echo "Build completed! To create an APK, you can:"
echo "1. Run build-android-apk.sh to build directly"
echo "2. Or follow these steps manually:"
echo "   a. Download the project files"
echo "   b. Open the android folder in Android Studio"
echo "   c. Run Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo "   d. The APK will be generated in android/app/build/outputs/apk/debug/"