import { Express } from "express";
import { ranks, getRankForLevel, calculateExpForLevel } from "../shared/schema.js";

export function registerDebugRoutes(app: Express) {
  // Debug endpoint to test database connection
  app.get('/api/debug/database', async (req, res) => {
    try {
      const { getPool } = await import('./db.js');
      const pool = await getPool();
      let client;

      try {
        console.log('Attempting to connect to database...');
        client = await pool.connect();
        const [result] = await client.query('SELECT 1 as test');

        res.json({
          success: true,
          environment: process.env.VERCEL === '1' ? 'Vercel' : 'Other',
          message: 'Database connection successful',
          result: result
        });
      } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({
          success: false,
          environment: process.env.VERCEL === '1' ? 'Vercel' : 'Other',
          error: err instanceof Error ? err.message : String(err),
          message: 'Database connection test failed'
        });
      } finally {
        if (client) client.release();
      }
    } catch (err) {
      console.error('Failed to import or initialize database:', err);
      res.status(500).json({
        success: false,
        environment: process.env.VERCEL === '1' ? 'Vercel' : 'Other',
        error: err instanceof Error ? err.message : String(err),
        message: 'Failed to initialize database connection'
      });
    }
  });

  // Debug endpoint to verify all levels and ranks
  app.get('/api/debug/levels', (req, res) => {
    const levels = [];

    // Generate sample levels covering all ranks
    const testLevels = [
      1, 10, 20, 30, 40, 50, 60, 70, 80, 100, 120, 150, 
      200, 250, 300, 350, 400, 450, 500, 575, 650, 725, 800, 
      1000, 1500, 2000
    ];

    // Calculate information for each level
    for (const level of testLevels) {
      const rank = getRankForLevel(level);
      const expForNextLevel = calculateExpForLevel(level);

      levels.push({
        level,
        rank: rank.name,
        expForNextLevel,
        minLevel: rank.minLevel,
        maxLevel: rank.maxLevel === Infinity ? "Infinity" : rank.maxLevel
      });
    }

    res.json({
      levels,
      allRanks: ranks
    });
  });

  // Profile simulator - view how profile will look at different levels
  app.get('/debug/profile-simulator', (req, res) => {
    const level = parseInt(req.query.level as string) || 1;
    const exp = parseInt(req.query.exp as string) || 0;
    const totalWorkoutSeconds = parseInt(req.query.seconds as string) || 3600; // Default 1 hour

    const rank = getRankForLevel(level);
    const expForNextLevel = calculateExpForLevel(level);
    const expProgress = ((exp / expForNextLevel) * 100).toFixed(1);

    // Format total workout time
    const formatDuration = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;

      let result = '';
      if (hours > 0) result += `${hours}h `;
      if (minutes > 0 || hours > 0) result += `${minutes}m `;
      result += `${remainingSeconds}s`;

      return result.trim();
    };

    // Read HTML template
    const templatePath = path.join(process.cwd(), 'server', 'debug-template.html');
    let template = '';

    try {
      if (fs.existsSync(templatePath)) {
        template = fs.readFileSync(templatePath, 'utf8');
      } else {
        // If template doesn't exist, use inline template
        template = `
<!DOCTYPE html>
<html>
<head>
  <title>Profile Simulator</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #111;
      color: #eee;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background-color: #222;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid #333;
    }
    .profile-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .rank-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    .username {
      font-size: 20px;
      font-weight: bold;
    }
    .rank-name {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .progress-container {
      background-color: #333;
      height: 8px;
      border-radius: 4px;
      margin-top: 8px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #9166ff, #7c4dff);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 16px;
    }
    .stat-box {
      background-color: rgba(145, 102, 255, 0.1);
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .stat-value {
      font-size: 18px;
      font-weight: bold;
      margin-top: 4px;
    }
    .simulator-controls {
      background-color: #222;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #333;
    }
    .form-group {
      margin-bottom: 12px;
    }
    label {
      display: block;
      margin-bottom: 6px;
    }
    input[type="number"] {
      background-color: #333;
      border: 1px solid #444;
      color: #fff;
      padding: 8px;
      border-radius: 4px;
      width: 100%;
    }
    button {
      background-color: #7c4dff;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover {
      background-color: #6c3aee;
    }
    .ranks-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 24px;
    }
    .rank-item {
      background-color: rgba(145, 102, 255, 0.1);
      border-radius: 6px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rank-item-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }
    .rank-item-details {
      flex: 1;
    }
    .current-rank {
      border: 2px solid #7c4dff;
    }
  </style>
</head>
<body>
  <h1>Profile Simulator</h1>

  <div class="simulator-controls">
    <form method="get">
      <div class="form-group">
        <label for="level">Level:</label>
        <input type="number" id="level" name="level" value="{{level}}" min="1" max="2000">
      </div>
      <div class="form-group">
        <label for="exp">Current EXP:</label>
        <input type="number" id="exp" name="exp" value="{{exp}}" min="0">
      </div>
      <div class="form-group">
        <label for="seconds">Total Workout Seconds:</label>
        <input type="number" id="seconds" name="seconds" value="{{totalWorkoutSeconds}}" min="0">
      </div>
      <button type="submit">Update Simulation</button>
    </form>
  </div>

  <div class="card">
    <div class="profile-header">
      <div class="rank-icon" style="background-color: {{rankColor}}">{{rankIcon}}</div>
      <div>
        <div class="username">Simulated User's Profile</div>
        <div class="rank-name" style="color: {{rankColor}}">Level {{level}} • {{rankName}}</div>
      </div>
    </div>

    <div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>EXP Progress</span>
        <span>{{exp}} / {{expForNextLevel}}</span>
      </div>
      <div class="progress-container">
        <div class="progress-bar" style="width: {{expProgress}}%"></div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-box">
        <div>Current Rank</div>
        <div class="stat-value" style="color: {{rankColor}}">{{rankName}}</div>
      </div>
      <div class="stat-box">
        <div>Total Time Worked Out</div>
        <div class="stat-value">{{totalWorkoutTime}}</div>
      </div>
    </div>
  </div>

  <h2>All Available Ranks</h2>
  <div class="ranks-list">
    {{ranksList}}
  </div>
</body>
</html>
        `;
      }
    } catch (error) {
      console.error('Error reading template:', error);
      template = '<html><body><h1>Error loading simulator template</h1></body></html>';
    }

    // Get rank color based on rank name
    const getRankColor = (rankName) => {
      const colors = {
        'E Rank': '#6b7280', // gray
        'D Rank': '#10b981', // green
        'C Rank': '#3b82f6', // blue
        'B Rank': '#8b5cf6', // purple
        'A Rank': '#ec4899', // pink
        'S Rank': '#f59e0b', // amber
        'National Level': '#ef4444', // red
        'Mid Tier Monarch': '#6366f1', // indigo
        'Yogumunt': '#0ea5e9', // sky
        'Architect': '#14b8a6', // teal
        'Amtares': '#a855f7', // fuchsia
        'Ashborn': '#ec4899', // pink
        'Sung Jinwo': '#f97316'  // orange
      };
      return colors[rankName] || '#9166ff';
    };

    // Generate ranks list HTML
    let ranksListHtml = '';
    ranks.forEach(r => {
      const color = getRankColor(r.name);
      const isCurrentRank = r.name === rank.name;
      ranksListHtml += `
        <div class="rank-item ${isCurrentRank ? 'current-rank' : ''}">
          <div class="rank-item-icon" style="background-color: ${color}">${r.name.charAt(0)}</div>
          <div class="rank-item-details">
            <div style="color: ${color}; font-weight: 600;">${r.name}</div>
            <div style="font-size: 14px; opacity: 0.8;">Level ${r.minLevel} - ${r.maxLevel === Infinity ? '∞' : r.maxLevel}</div>
          </div>
        </div>
      `;
    });

    // Replace template variables
    const rankColor = getRankColor(rank.name);
    const html = template
      .replace(/{{level}}/g, level.toString())
      .replace(/{{exp}}/g, exp.toString())
      .replace(/{{totalWorkoutSeconds}}/g, totalWorkoutSeconds.toString())
      .replace(/{{rankName}}/g, rank.name)
      .replace(/{{rankIcon}}/g, rank.name.charAt(0))
      .replace(/{{rankColor}}/g, rankColor)
      .replace(/{{expForNextLevel}}/g, expForNextLevel.toString())
      .replace(/{{expProgress}}/g, expProgress)
      .replace(/{{totalWorkoutTime}}/g, formatDuration(totalWorkoutSeconds))
      .replace(/{{ranksList}}/g, ranksListHtml);

    res.send(html);
  });
}
