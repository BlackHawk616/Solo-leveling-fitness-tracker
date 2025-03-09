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

## Deployment
1. Fork this repository
2. Create a new project on Vercel
3. Set up a PostgreSQL database:
   - Go to [Neon.tech](https://neon.tech) and create a free account
   - Create a new project
   - In the project dashboard, find your database connection string
   - It should look like: `postgres://user:password@host:port/database`
   - Make sure the connection string includes `?sslmode=require` at the end
4. Connect your GitHub repository to Vercel
5. Set up environment variables in Vercel:
   - Go to Project Settings > Environment Variables
   - Add DATABASE_URL (your Neon connection string without quotes)
   - Add Firebase configuration variables:
     ```
     VITE_FIREBASE_API_KEY
     VITE_FIREBASE_AUTH_DOMAIN
     VITE_FIREBASE_PROJECT_ID
     VITE_FIREBASE_STORAGE_BUCKET
     VITE_FIREBASE_MESSAGING_SENDER_ID
     VITE_FIREBASE_APP_ID
     ```
   - Make sure each variable is enabled for Production and Preview environments
6. Deploy!

## Manual Deployment Steps
1. Download the code from Replit
2. Create a new GitHub repository
3. Initialize Git and push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```
4. Create a new project on Vercel
5. Set up a PostgreSQL database using Neon.tech:
   - Sign up at [Neon.tech](https://neon.tech)
   - Create a new project
   - Copy your database connection string (with ?sslmode=require)
6. Connect your GitHub repository to Vercel
7. Set up environment variables in Vercel:
   - Add DATABASE_URL without quotes
   - Add all Firebase configuration variables
   - Enable variables for Production and Preview environments
8. Deploy!

## Troubleshooting Deployment
If you encounter database connection issues:
1. Verify the DATABASE_URL is correctly added without quotes
2. Ensure the connection string ends with ?sslmode=require
3. Check that the environment variable is enabled for all environments
4. Try redeploying after saving the environment variables
5. Make sure you've selected "Vite" as your framework in Vercel
6. Check that your database is in the same region as your Vercel deployment
7. Verify that your Neon database project is active and running

## Local Development
1. Clone the repository
2. Copy `.env.example` to `.env` and fill in the values
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`

## License
MIT