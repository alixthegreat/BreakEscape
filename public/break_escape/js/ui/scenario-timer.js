/**
 * ScenarioTimerUI - Countdown timer HUD widget for scenario events
 * 
 * Displays a countdown to the next pending scenario timer event, with visual
 * urgency indicators (amber for < 5min, red for < 1min). Integrates with the
 * scenario timer event system to track event firing status.
 * 
 * USAGE:
 *   window.scenarioTimerUI = new ScenarioTimerUI(game, scenario);
 *   window.scenarioTimerUI.markFired('event-id');  // when timer fires
 * 
 * @class ScenarioTimerUI
 */
class ScenarioTimerUI {
  /**
   * @constructor
   * @param {Phaser.Game} game - Phaser game instance
   * @param {Object} scenario - Scenario JSON object with timers[] section
   */
  constructor(game, scenario) {
    this.game = game;
    this.scenario = scenario;
    this.timers = scenario.timers || [];
    this.firedTimers = new Set();  // Track which timers have already fired
    this.startTime = Date.now();
    
    // Create HUD display element
    this.createDisplay();
    
    // Start tick loop for countdown update
    this.tickInterval = setInterval(() => this._tick(), 100);  // Update every 100ms
    
    console.log(`⏱️ ScenarioTimerUI initialized with ${this.timers.length} timers`);
  }

  /**
   * Create the HTML HUD display element
   * @private
   */
  createDisplay() {
    // Check if display already exists
    if (document.getElementById('scenario-timer-display')) {
      this.displayElement = document.getElementById('scenario-timer-display');
      return;
    }
    
    // Create container div
    this.displayElement = document.createElement('div');
    this.displayElement.id = 'scenario-timer-display';
    this.displayElement.className = 'scenario-timer-container';
    
    // Create label (event name)
    this.labelElement = document.createElement('div');
    this.labelElement.className = 'scenario-timer-label';
    this.labelElement.textContent = 'Next Event:';
    
    // Create clock display (mm:ss)
    this.clockElement = document.createElement('div');
    this.clockElement.className = 'scenario-timer-clock';
    this.clockElement.textContent = '--:--';
    
    // Assemble display
    this.displayElement.appendChild(this.labelElement);
    this.displayElement.appendChild(this.clockElement);
    document.body.appendChild(this.displayElement);
  }

  /**
   * Mark a timer as fired (remove from countdown display)
   * @param {string} timerId - ID of the timer that just fired
   */
  markFired(timerId) {
    this.firedTimers.add(timerId);
    console.log(`✅ Timer fired: ${timerId}, marked as complete`);
  }

  /**
   * Get the next pending timer (oldest unmet condition, showCountdown=true)
   * @private
   * @returns {Object|null} Timer config or null if none pending
   */
  _getNextPendingTimer() {
    for (const timer of this.timers) {
      // Skip if already fired
      if (this.firedTimers.has(timer.id)) {
        continue;
      }
      
      // Skip if not configured to show countdown
      if (!timer.showCountdown) {
        continue;
      }
      
      // Skip if condition doesn't pass (evaluate condition string against globalVars)
      if (timer.condition) {
        try {
          const globalVars = window.gameState?.globalVariables || {};
          const conditionResult = this._evaluateCondition(timer.condition, globalVars);
          if (!conditionResult) {
            continue;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to evaluate condition for timer ${timer.id}: ${error.message}`);
          continue;
        }
      }
      
      // This timer is pending - return it
      return timer;
    }
    
    return null;  // No pending timers
  }

  /**
   * Evaluate a condition string against globalVariables
   * Supports compound conditions with &&, equality checks, and string/number literals
   * Examples:
   *   - "globalVars.timer_test_active" (truthy check)
   *   - "globalVars.bed_state_1 === 'alert'" (string equality)
   *   - "globalVars.timer_test_active && globalVars.bed_state_1 === 'alert'" (compound)
   *   - "!globalVars.locked" (negation)
   * @private
   * @param {string} condition - Condition expression
   * @param {Object} globalVars - Map of global variable values
   * @returns {boolean} Evaluation result
   */
  _evaluateCondition(condition, globalVars) {
    // Helper: parse a literal value (string, number, boolean, null)
    const parseLiteral = (token) => {
      const t = token.trim();
      if (t === 'true') return true;
      if (t === 'false') return false;
      if (t === 'null') return null;
      const num = Number(t);
      if (!isNaN(num) && t !== '') return num;
      // String literal: "value" or 'value'
      const strMatch = t.match(/^['"](.*)['"]$/);
      if (strMatch) return strMatch[1];
      return t;
    };

    // Helper: evaluate a single condition (no &&)
    const evaluateSingleCondition = (expr) => {
      expr = expr.trim();

      // Handle negation: !globalVars.X
      if (expr.startsWith('!')) {
        const varName = expr.replace('!globalVars.', '').trim();
        return !globalVars[varName];
      }

      // Handle equality/inequality: globalVars.X === 'value' or globalVars.X !== 'value'
      if (expr.includes('===') || expr.includes('!==')) {
        const op = expr.includes('===') ? '===' : '!==';
        const [left, right] = expr.split(op).map(s => s.trim());
        const varName = left.replace('globalVars.', '').trim();
        const varValue = globalVars[varName];
        const rightValue = parseLiteral(right);
        return op === '===' ? varValue === rightValue : varValue !== rightValue;
      }

      // Handle comparison operators: >, <, >=, <=
      const compMatch = expr.match(/globalVars\.(\w+)\s*(>=|<=|>|<)\s*(.+)/);
      if (compMatch) {
        const varName = compMatch[1];
        const op = compMatch[2];
        const rightValue = parseLiteral(compMatch[3]);
        const varValue = globalVars[varName];
        switch (op) {
          case '>=': return varValue >= rightValue;
          case '<=': return varValue <= rightValue;
          case '>': return varValue > rightValue;
          case '<': return varValue < rightValue;
        }
      }

      // Default: check if globalVars.X exists and is truthy
      const varMatch = expr.match(/globalVars\.(\w+)/);
      if (varMatch) {
        const varName = varMatch[1];
        return !!globalVars[varName];
      }

      return false;
    };

    // Handle compound conditions with &&
    if (condition.includes('&&')) {
      return condition.split('&&').every(part => evaluateSingleCondition(part));
    }

    return evaluateSingleCondition(condition);
  }

  /**
   * Calculate elapsed time and update display
   * @private
   */
  _tick() {
    const nextTimer = this._getNextPendingTimer();
    
    if (!nextTimer) {
      // No pending timers - hide display
      this.displayElement.style.display = 'none';
      return;
    }
    
    // Show display
    this.displayElement.style.display = 'block';
    
    // Calculate time remaining
    const elapsedMs = Date.now() - this.startTime;
    const remainingMs = nextTimer.delayMs - elapsedMs;
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
    
    // Format as mm:ss
    const minutes = Math.floor(remainingSec / 60);
    const seconds = remainingSec % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update label and clock
    this.labelElement.textContent = nextTimer.label || 'Incoming Event';
    this.clockElement.textContent = timeStr;
    
    // Update urgency class
    this.displayElement.classList.remove('scenario-timer--amber', 'scenario-timer--red');
    if (remainingSec < 60) {
      this.displayElement.classList.add('scenario-timer--red');  // < 1 min: RED
    } else if (remainingSec < 300) {
      this.displayElement.classList.add('scenario-timer--amber');  // < 5 min: AMBER
    }
  }

  /**
   * Cleanup: stop update interval and remove display element
   */
  destroy() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    if (this.displayElement && this.displayElement.parentNode) {
      this.displayElement.parentNode.removeChild(this.displayElement);
    }
    console.log(`🗑️ ScenarioTimerUI destroyed`);
  }
}

// ES6 named export
export { ScenarioTimerUI };

// Also attach to window for global access
if (typeof window !== 'undefined') {
  window.ScenarioTimerUI = ScenarioTimerUI;
}
