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
4. Connect your GitHub repository to Vercel
5. Set up the following environment variables in Vercel:
   - `DATABASE_URL` (Your Neon database connection string)
   - Firebase configuration variables:
     ```
     VITE_FIREBASE_API_KEY
     VITE_FIREBASE_AUTH_DOMAIN
     VITE_FIREBASE_PROJECT_ID
     VITE_FIREBASE_STORAGE_BUCKET
     VITE_FIREBASE_MESSAGING_SENDER_ID
     VITE_FIREBASE_APP_ID
     ```
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
   - Copy your database connection string
6. Connect your GitHub repository to Vercel
7. Set up the environment variables in Vercel:
   - Add your Neon DATABASE_URL
   - Add all Firebase configuration variables
8. Deploy!

## Local Development
1. Clone the repository
2. Copy `.env.example` to `.env` and fill in the values
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`

## License
MIT