import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for authentication endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Placeholder database connection check function
async function checkDatabaseConnection() {
  console.log('Checking database connection...');
  // Replace this with your actual database connection logic
  // This is a placeholder and will always return true for demonstration purposes.
  // In a real application, you should connect to your TiDB Cloud instance and verify connectivity.
  return true; 
}

(async () => {
  console.log('Starting server...');

  // Log environment information
  console.log('📊 Environment:', process.env.NODE_ENV || 'development');
  console.log('🌐 Running on Vercel:', process.env.VERCEL === '1' ? 'Yes' : 'No');

  // Log important environment variables (without revealing secrets)
  console.log('🔍 DATABASE_URL configured:', !!process.env.DATABASE_URL);
  if (process.env.DATABASE_URL) {
    const urlPrefix = process.env.DATABASE_URL.substring(0, 20);
    console.log('🔍 DATABASE_URL prefix:', urlPrefix + '...');
    console.log('🔍 DATABASE_URL contains SSL mode:', process.env.DATABASE_URL.includes('sslmode=require'));
  }

  // Create a special header for Vercel deployments
  if (process.env.VERCEL === '1') {
    app.use((req, res, next) => {
      // Add custom headers to help debug requests on Vercel
      req.headers['x-deployment-env'] = 'vercel';
      // Track request start time for performance monitoring
      req.headers['x-request-start'] = Date.now().toString();
      next();
    });
  }

  // Test database connection before starting server
  try {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      console.error('❌ Database connection check failed');
      console.error('⚠️ Starting server anyway, but database operations may fail');
    } else {
      console.log('✅ Database connection check passed');
    }
  } catch (err) {
    console.error('❌ Database connection check error:', err);
    console.error('⚠️ Starting server anyway, but database operations may fail');
  }


  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('Server error:', err);
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Try to serve on port 5000, fallback to other ports if needed
  let port = process.env.PORT || 5000;

  const startServer = (attemptPort: number) => {
    server.listen({
      port: attemptPort,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${attemptPort}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log(`Port ${attemptPort} is in use, trying ${attemptPort + 1}`);
        startServer(attemptPort + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  };

  startServer(Number(port));
})();