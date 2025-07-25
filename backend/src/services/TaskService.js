import { Task, UserTaskProgress } from '../models/Task.js';
import { PromotionService } from './PromotionService.js';
import { Character } from '../models/Character.js';
import { BankAccount } from '../models/Bank.js';
import { Statistic } from '../models/Statistic.js';
import { Op } from 'sequelize';

export class TaskService {
  // Check and update task progress based on current character stats
  static async checkAndUpdateTaskProgress(userId) {
    const character = await Character.findOne({ where: { userId } });
    if (!character) return;

    // Get all active tasks
    const tasks = await Task.findAll({ where: { isActive: true } });
    
    for (const task of tasks) {
      let progress = await UserTaskProgress.findOne({ where: { userId, taskId: task.id } });
      if (!progress) {
        progress = await UserTaskProgress.create({ userId, taskId: task.id, progress: 0 });
      }

      // Get current value for the metric
      const currentValue = await this.getCurrentMetricValue(character, task.metric);
      
      // Debug logging
      console.log(`Task ${task.id} (${task.metric}): Current value = ${currentValue}, Goal = ${task.goal}, Current progress = ${progress.progress}`);
      
      // Update progress based on metric type
      if (this.isCumulativeMetric(task.metric)) {
        // For cumulative metrics, use the current value directly
        progress.progress = currentValue;
      } else {
        // For snapshot metrics, use the current value if it's higher than current progress
        if (currentValue > progress.progress) {
          progress.progress = currentValue;
        }
      }

      // Mark as completed if goal met
      if (!progress.isCompleted && progress.progress >= task.goal) {
        progress.isCompleted = true;
        console.log(`Task ${task.id} marked as completed! Progress: ${progress.progress}, Goal: ${task.goal}`);
      }

      await progress.save();
    }
  }

  // Get current value for a specific metric
  static async getCurrentMetricValue(character, metric) {
    switch (metric) {
      case 'level':
        return character.level;
      case 'money':
        return character.money;
      case 'blackcoins':
        return character.blackcoins;
      case 'fame':
        return await character.getFame();
      case 'bank_balance':
        // Fetch bank balance from BankAccount model
        const bankAccount = await BankAccount.findOne({ where: { userId: character.userId } });
        return bankAccount ? bankAccount.balance : 0;
      case 'days_in_game':
        // Calculate days since character creation
        const createdAt = new Date(character.createdAt);
        const now = new Date();
        return Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      case 'fights_won':
        // Get from Statistic model
        const statsWon = await Statistic.findOne({ where: { userId: character.userId } });
        return statsWon ? statsWon.wins : 0;
      case 'fights_lost':
        // Get from Statistic model
        const statsLost = await Statistic.findOne({ where: { userId: character.userId } });
        return statsLost ? statsLost.losses : 0;
      case 'total_fights':
        // Get from Statistic model
        const statsTotal = await Statistic.findOne({ where: { userId: character.userId } });
        return statsTotal ? statsTotal.fights : 0;
      case 'kill_count':
        return character.killCount || 0;
      case 'damage_dealt':
        // This might not be tracked, return 0 for now
        return 0;
      case 'crimes_committed':
        // Get from Statistic model
        const statsCrimes = await Statistic.findOne({ where: { userId: character.userId } });
        return statsCrimes ? statsCrimes.crimes : 0;
      case 'jobs_completed':
        // This might not be tracked, return 0 for now
        return 0;
      case 'ministry_missions_completed':
        // This might not be tracked, return 0 for now
        return 0;
      case 'money_deposited':
        // This might not be tracked, return 0 for now
        return 0;
      case 'money_withdrawn':
        // This might not be tracked, return 0 for now
        return 0;
      case 'blackmarket_items_bought':
        // This might not be tracked, return 0 for now
        return 0;
      case 'blackmarket_items_sold':
        // This might not be tracked, return 0 for now
        return 0;
      case 'gang_joined':
        // Check if character has a gang
        return character.gangId ? 1 : 0;
      case 'gang_created':
        // This might not be tracked, return 0 for now
        return 0;
      case 'gang_money_contributed':
        // This might not be tracked, return 0 for now
        return 0;
      case 'houses_owned':
        // This might not be tracked, return 0 for now
        return 0;
      case 'dogs_owned':
        // This might not be tracked, return 0 for now
        return 0;
      case 'suggestions_submitted':
        // This might not be tracked, return 0 for now
        return 0;
      default:
        return 0;
    }
  }

  // Check if a metric is cumulative (increments over time) or snapshot (current value)
  static isCumulativeMetric(metric) {
    const cumulativeMetrics = [
      'fights_won', 'fights_lost', 'total_fights', 'kill_count', 'damage_dealt',
      'crimes_committed', 'jobs_completed', 'ministry_missions_completed',
      'money_deposited', 'money_withdrawn', 'blackmarket_items_bought',
      'blackmarket_items_sold', 'gang_joined', 'gang_created', 'gang_money_contributed',
      'houses_owned', 'dogs_owned', 'suggestions_submitted'
    ];
    return cumulativeMetrics.includes(metric);
  }

  // Call this whenever a player performs a trackable action
  static async updateProgress(userId, metric, value = 1, transaction = null) {
    try {
      console.log(`[TaskService] Updating progress for user ${userId}, metric ${metric}, value ${value}`);
      
      // Ensure value is a number
      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        console.error(`[TaskService] Invalid value for metric ${metric}: ${value}`);
        return;
      }
      
      // Find all active tasks for this metric
      const tasks = await Task.findAll({ 
        where: { metric, isActive: true },
        transaction 
      });
      
      for (const task of tasks) {
        let progress = await UserTaskProgress.findOne({ 
          where: { userId, taskId: task.id },
          transaction 
        });
        if (!progress) {
          progress = await UserTaskProgress.create({ 
            userId, taskId: task.id, progress: 0 
          }, { transaction });
        }
        // For cumulative metrics, increment; for snapshot metrics, set
        if (this.isCumulativeMetric(metric)) {
          progress.progress = Math.floor(progress.progress + numericValue);
        } else {
          // For snapshot metrics (level, money, fame, bank_balance, blackcoins, days_in_game, etc.)
          if (numericValue > progress.progress) progress.progress = Math.floor(numericValue);
        }
        // Mark as completed if goal met
        if (!progress.isCompleted && progress.progress >= task.goal) {
          progress.isCompleted = true;
        }
        await progress.save({ transaction });
      }
    } catch (error) {
      console.error(`[TaskService] Error updating progress for user ${userId}, metric ${metric}:`, error);
      throw error;
    }
  }

  // Award progress points and check for promotion
  static async awardProgressPoints(userId, points) {
    if (points > 0) {
      await PromotionService.addProgressPoints(userId, points);
    }
  }
} 