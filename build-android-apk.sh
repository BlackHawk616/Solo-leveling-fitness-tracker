
#!/bin/bash

echo "Building Solo Leveling Fitness App APK..."

# Build the web app
npm run build

# Sync the web code to the Android project
npx cap sync

echo "Building Release APK..."
cd android

# Set Java 17 for the build process
echo "org.gradle.java.home=/nix/store/jd33ngidpqfj6rj0dxmsn1hkdxx6jfwh-openjdk-17.0.9+9/lib/openjdk" >> gradle.properties

# Create local.properties with SDK path
echo "sdk.dir=$HOME/android-sdk" > local.properties

# Create a keystore for signing the APK
if [ ! -f "app/solo-fitness.keystore" ]; then
  echo "Creating keystore for signing..."
  mkdir -p app/src/main/assets/public
  keytool -genkeypair -v -keystore app/solo-fitness.keystore -alias solo-fitness -keyalg RSA -keysize 2048 -validity 10000 -storepass solofitness -keypass solofitness -dname "CN=Solo Fitness, O=Solo Fitness, L=Unknown, ST=Unknown, C=US"
fi

# Create gradle.properties if it doesn't exist
if [ ! -f "gradle.properties" ]; then
  echo "Creating gradle.properties..."
  echo "org.gradle.jvmargs=-Xmx2048m" > gradle.properties
  echo "android.useAndroidX=true" >> gradle.properties
  echo "android.enableJetifier=true" >> gradle.properties
  echo "RELEASE_STORE_FILE=solo-fitness.keystore" >> gradle.properties
  echo "RELEASE_KEY_ALIAS=solo-fitness" >> gradle.properties
  echo "RELEASE_STORE_PASSWORD=solofitness" >> gradle.properties
  echo "RELEASE_KEY_PASSWORD=solofitness" >> gradle.properties
fi

# Update app/build.gradle to include signing config
if ! grep -q "signingConfigs" app/build.gradle; then
  sed -i '/defaultConfig {/i \
    signingConfigs {\
        release {\
            storeFile file(RELEASE_STORE_FILE)\
            storePassword RELEASE_STORE_PASSWORD\
            keyAlias RELEASE_KEY_ALIAS\
            keyPassword RELEASE_KEY_PASSWORD\
        }\
    }' app/build.gradle
  
  sed -i 's/buildTypes {/buildTypes {\
        release {\
            signingConfig signingConfigs.release\
            minifyEnabled false\
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"\
        }/' app/build.gradle
fi

# Execute Gradle build to create APK
./gradlew assembleRelease

# Copy APK files to a more accessible location in project root
mkdir -p ../builds
cp app/build/outputs/apk/release/app-release.apk ../builds/SoloLevelingFitness-release.apk
cp app/build/outputs/apk/debug/app-debug.apk ../builds/SoloLevelingFitness-debug.apk

echo "APK built successfully!"
echo "Release APK location: builds/SoloLevelingFitness-release.apk"
echo "Debug APK location: builds/SoloLevelingFitness-debug.apk"

# Return to the project root directory
cd ..

echo "To use the APK:"
echo "1. Download the APK file from the Replit file explorer > builds folder"
echo "2. Transfer it to your Android device"
echo "3. Install and run the app on your device"
