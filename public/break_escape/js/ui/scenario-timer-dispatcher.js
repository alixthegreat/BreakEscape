/**
 * ScenarioTimerDispatcher - Manages timer execution for scenario events
 * 
 * Tracks elapsed game time and fires scenario timers when their delay is reached.
 * When a timer fires, executes its setGlobal action and notifies the UI widget.
 * 
 * USAGE:
 *   window.scenarioTimerDispatcher = new ScenarioTimerDispatcher(scenario);
 *   scenarioTimerDispatcher.update(elapsedMs);  // call from game update loop
 * 
 * @class ScenarioTimerDispatcher
 */
class ScenarioTimerDispatcher {
  /**
   * @constructor
   * @param {Object} scenario - Scenario JSON object with timers[] section
   */
  constructor(scenario) {
    this.scenario = scenario;
    this.timers = scenario.timers || [];
    this.firedTimers = new Set();  // Track which timers have already fired
    this.startTime = Date.now();
    
    console.log(`⏱️ ScenarioTimerDispatcher initialized with ${this.timers.length} timer(s)`);
  }

  /**
   * Update timer state (call once per game loop tick)
   * Pass the current timestamp to calculate elapsed time from dispatcher initialization
   * @param {number} currentTimeMs - Current timestamp in milliseconds (e.g., Date.now())
   */
  update(currentTimeMs) {
    const elapsedMs = currentTimeMs - this.startTime;
    
    for (const timer of this.timers) {
      // Skip if already fired
      if (this.firedTimers.has(timer.id)) {
        continue;
      }

      // Skip if onceOnly and has fired before (double-check)
      if (timer.onceOnly && this.firedTimers.has(timer.id)) {
        continue;
      }

      // Check if delay has elapsed
      if (elapsedMs >= timer.delayMs) {
        this._fireTimer(timer);
      }
    }
  }

  /**
   * Execute a timer's actions
   * @private
   * @param {Object} timer - Timer configuration object
   */
  _fireTimer(timer) {
    console.log(`🔥 Timer fired: ${timer.id} (delayMs: ${timer.delayMs})`);

    // Evaluate timer condition if present
    if (timer.condition) {
      try {
        const globalVars = window.gameState?.globalVariables || {};
        const conditionResult = this._evaluateCondition(timer.condition, globalVars);
        if (!conditionResult) {
          console.log(`ℹ️ Timer condition failed for ${timer.id}, skipping execution`);
          this.firedTimers.add(timer.id);  // Still mark as fired (condition block)
          return;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to evaluate condition for timer ${timer.id}: ${error.message}`);
        this.firedTimers.add(timer.id);
        return;
      }
    }

    // Execute setGlobal action if present
    if (timer.setGlobal && typeof timer.setGlobal === 'object') {
      this._executeSetGlobal(timer.setGlobal);
    }

    // Mark as fired
    this.firedTimers.add(timer.id);

    // Notify UI widget
    if (window.scenarioTimerUI) {
      window.scenarioTimerUI.markFired(timer.id);
    }

    console.log(`✅ Timer ${timer.id} completed`);
  }

  /**
   * Execute a setGlobal action (set variables and broadcast)
   * @private
   * @param {Object} globalVarUpdates - Map of variable names to values
   */
  _executeSetGlobal(globalVarUpdates) {
    const globalVars = window.gameState?.globalVariables || {};
    
    for (const [varName, value] of Object.entries(globalVarUpdates)) {
      const oldValue = globalVars[varName];
      globalVars[varName] = value;
      
      console.log(`🌐 Timer setGlobal: ${varName} = ${value} (was ${oldValue})`);
      
      // Broadcast variable change event for NPC eventMappings to react
      if (window.eventDispatcher) {
        window.eventDispatcher.emit(`global_variable_changed:${varName}`, {
          varName: varName,
          oldValue: oldValue,
          value: value,
          source: 'scenario-timer'
        });
      }
    }
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
   * Cleanup: stop processing timers
   */
  destroy() {
    console.log(`🗑️ ScenarioTimerDispatcher destroyed`);
  }
}

// ES6 named export
export { ScenarioTimerDispatcher };

// Also attach to window for global access
if (typeof window !== 'undefined') {
  window.ScenarioTimerDispatcher = ScenarioTimerDispatcher;
}
