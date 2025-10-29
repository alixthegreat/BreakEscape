// Minimal InkEngine wrapper around the global inkjs.Story
// Exports a default class InkEngine matching the test harness API.
export default class InkEngine {
  constructor(id) {
    this.id = id || 'ink-engine';
    this.story = null;
  }

  // Accepts a parsed JSON object (ink.json) or a JSON string
  loadStory(storyJson) {
    if (!storyJson) throw new Error('No story JSON provided');
    // inkjs may accept either an object or a string; the test harness provides parsed JSON
    // inkjs library is available as global `inkjs` (loaded via assets/vendor/ink.js)
    if (typeof storyJson === 'string') {
      this.story = new inkjs.Story(storyJson);
    } else {
      // If it's an object, stringify then pass to constructor
      this.story = new inkjs.Story(JSON.stringify(storyJson));
    }
    
    // Do an initial continue to get the first content
    // (if story starts at root and immediately exits, this won't produce text)
    if (this.story.canContinue) {
      this.continue();
    }
    
    return this.story;
  }

  // Continue the story and return the current text plus state
  continue() {
    if (!this.story) throw new Error('Story not loaded');
    try {
      // Call Continue() to advance the story
      while (this.story.canContinue) {
        this.story.Continue();
      }
      
      // Return structured result with text, choices, and continue state
      return {
        text: this.story.currentText || '',
        choices: (this.story.currentChoices || []).map((c, i) => ({ text: c.text, index: i })),
        canContinue: this.story.canContinue
      };
    } catch (e) {
      // inkjs uses Continue() and throws for errors; rethrow with nicer message
      throw e;
    }
  }

  // Go to a knot/stitch by name
  goToKnot(knotName) {
    if (!this.story) throw new Error('Story not loaded');
    if (!knotName) return;
    // inkjs expects ChoosePathString for high-level path selection
    this.story.ChoosePathString(knotName);
  }

  // Return the current text produced by the story
  get currentText() {
    if (!this.story) return '';
    return this.story.currentText || '';
  }

  // Return current choices as an array of objects { text, index }
  get currentChoices() {
    if (!this.story) return [];
    return (this.story.currentChoices || []).map((c, i) => ({ text: c.text, index: i }));
  }

  // Choose a choice index
  choose(index) {
    if (!this.story) throw new Error('Story not loaded');
    if (typeof index !== 'number') throw new Error('choose() expects a numeric index');
    this.story.ChooseChoiceIndex(index);
  }

  // Variable accessors
  getVariable(name) {
        if (!this.story) throw new Error('Story not loaded');
        const val = this.story.variablesState.GetVariableWithName(name);
        // inkjs returns runtime value wrappers; try to unwrap common cases
        try {
            if (val && typeof val === 'object') {
                // common numeric/string wrapper types expose value or valueObject
                if ('value' in val) return val.value;
                if ('valueObject' in val) return val.valueObject;
            }
        } catch (e) {
            // ignore and return raw
        }
        return val;
  }

  setVariable(name, value) {
        if (!this.story) throw new Error('Story not loaded');
        // inkjs VariableState.SetGlobal expects a RuntimeObject; it's forgiving for primitives
        this.story.variablesState.SetGlobal(name, value);
  }
}
