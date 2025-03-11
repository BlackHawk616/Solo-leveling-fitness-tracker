# Solo Leveling Fitness App

A gamified workout tracking application inspired by Solo Leveling, built with React, TypeScript, and Firebase.

## Features
- User authentication with Firebase
- Workout tracking with real-time updates
- Experience points (EXP) and leveling system
- Rank progression system
- Persistent workout history

## Tech Stack
- Frontend: React + TypeScript + Vite
- Backend: Express + Node.js
- Database: PostgreSQL
- Authentication: Firebase
- Styling: Tailwind CSS + shadcn/ui
- Mobile: Capacitor for Android build

## Building the Android APK

### Through GitHub Actions (Recommended)
1. Create a GitHub account if you don't have one at [GitHub](https://github.com)
2. Create a new repository:
   - Go to https://github.com/new
   - Give your repository a name
   - Make it Public
   - Click "Create repository"

3. Push your code to GitHub:
   ```bash
   # In your Replit shell
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

4. The Android APK build will start automatically:
   - Go to your GitHub repository
   - Click the "Actions" tab
   - You'll see "Build Android App" workflow running
   - Wait for it to complete (takes about 5-10 minutes)
   - Click on the completed workflow
   - Scroll down to "Artifacts"
   - Download the "app-debug" file
   - Extract the .zip to get your .apk file

5. Install the APK on your Android device:
   - Transfer the APK to your Android device
   - On your device, open the APK
   - Allow installation from unknown sources if prompted
   - Follow the installation prompts

### Troubleshooting
If the build fails:
1. Check the Actions tab for error details
2. Make sure all environment variables are set in GitHub:
   - Go to repository Settings > Secrets and Variables > Actions
   - Add your Firebase configuration as secrets:
     ```
     VITE_FIREBASE_API_KEY
     VITE_FIREBASE_AUTH_DOMAIN
     VITE_FIREBASE_PROJECT_ID
     VITE_FIREBASE_STORAGE_BUCKET
     VITE_FIREBASE_MESSAGING_SENDER_ID
     VITE_FIREBASE_APP_ID
     ```
3. Try re-running the workflow after fixing any issues

## Development
1. Copy `.env.example` to `.env` and fill in the values
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## License
MIT