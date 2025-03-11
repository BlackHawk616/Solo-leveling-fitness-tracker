#!/bin/bash

echo "Building Solo Leveling Fitness App for Android..."

# Exit on error
set -e

# Check Java version and installation
echo "Checking Java installation..."
if ! command -v java &> /dev/null; then
    echo "Error: Java is not installed"
    exit 1
fi

# Print Java version and environment
java -version
JAVA_PATH=$(dirname $(dirname $(readlink -f $(which java))))
export JAVA_HOME=$JAVA_PATH
echo "Using JAVA_HOME=$JAVA_HOME"

# Build the web app
echo "Building web application..."
if ! npm run build; then
    echo "Web build failed! Check the build output above for details."
    exit 1
fi

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

# Initialize Capacitor
echo "Initializing Capacitor..."
npx cap add android

# Configure Gradle properties
echo "Configuring Gradle properties..."
cat > android/gradle.properties << EOL
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
android.overridePathCheck=true
org.gradle.java.home=$JAVA_HOME
EOL

# Update root build.gradle
echo "Updating root build.gradle..."
cat > android/build.gradle << EOL
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks.register('clean', Delete) {
    delete rootProject.buildDir
}
EOL

# Update app build.gradle
echo "Updating app build.gradle..."
cat > android/app/build.gradle << EOL
apply plugin: 'com.android.application'

android {
    namespace "com.solofitness.app"
    compileSdk 34

    defaultConfig {
        applicationId "com.solofitness.app"
        minSdk 22
        targetSdk 34
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
}

dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar'])
    implementation project(':capacitor-android')
    implementation project(':capacitor-cordova-android-plugins')
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
    implementation 'androidx.appcompat:appcompat:1.6.1'
}
EOL

# Sync Capacitor
echo "Syncing Capacitor..."
npx cap sync

# Navigate to android directory
cd android

# Make gradlew executable
echo "Making gradlew executable..."
chmod +x gradlew

# Build debug APK with detailed logging
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