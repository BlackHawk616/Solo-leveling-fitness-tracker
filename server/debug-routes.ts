
import { Express } from "express";
import { ranks, getRankForLevel, calculateExpForLevel } from "../shared/schema.js";

export function registerDebugRoutes(app: Express) {
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
}
