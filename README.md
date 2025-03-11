# Solo Leveling Fitness App

A gamified workout tracking application inspired by Solo Leveling, built with React, TypeScript, and Firebase.

## Features
- User authentication with Firebase
- Workout tracking with real-time updates
- Experience points (EXP) and leveling system
- Rank progression system
- Persistent workout history

## Building the Android APK

### Steps to Build:
1. Create a GitHub account if you don't have one at [GitHub](https://github.com)
2. Create a new repository:
   - Go to https://github.com/new
   - Give your repository a name
   - Make it Public
   - Click "Create repository"

3. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

4. Add Firebase secrets in GitHub:
   - Go to repository Settings > Secrets and Variables > Actions
   - Add these secrets from your .env file:
     ```
     VITE_FIREBASE_API_KEY
     VITE_FIREBASE_AUTH_DOMAIN
     VITE_FIREBASE_PROJECT_ID
     VITE_FIREBASE_STORAGE_BUCKET
     VITE_FIREBASE_MESSAGING_SENDER_ID
     VITE_FIREBASE_APP_ID
     ```

5. Get your APK:
   - Go to your repository's Actions tab
   - Wait for the "Build Android App" workflow to complete (5-10 minutes)
   - Download the "app-debug" artifact
   - Extract the .zip to get your APK file

6. Install on Android:
   - Transfer the APK to your Android device
   - Open the APK file
   - Allow installation from unknown sources if prompted
   - Follow the installation prompts

### Need Help?
If the build fails:
1. Check the Actions tab for error details
2. Verify all Firebase secrets are added correctly
3. Try running the workflow again

## Tech Stack
- Frontend: React + TypeScript + Vite
- Backend: Express + Node.js
- Database: PostgreSQL
- Authentication: Firebase
- Styling: Tailwind CSS + shadcn/ui
- Mobile: Capacitor for Android build

## License
MIT