// Minimal NPCBarkSystem
// default export class NPCBarkSystem
export default class NPCBarkSystem {
  constructor(npcManager) {
    this.npcManager = npcManager;
    this.container = null;
  }

  init() {
    // create a simple container for barks if missing
    if (!document) return;
    this.container = document.getElementById('npc-bark-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'npc-bark-container';
      const style = this.container.style;
      style.position = 'fixed';
      style.right = '12px';
      style.top = '12px';
      style.zIndex = 9999;
      style.pointerEvents = 'auto';
      document.body.appendChild(this.container);
    }
  }

    // payload: { npcId, text|message, duration, onClick, openPhone }
    showBark(payload = {}) {
    if (!this.container) this.init();
        const { npcId, npcName } = payload;
        const text = payload.text || payload.message || '';
    const duration = ('duration' in payload) ? payload.duration : 4000;
    const el = document.createElement('div');
    el.className = 'npc-bark';
    el.textContent = (npcId ? npcId + ': ' : '') + (text || '...');
    // basic styling
    el.style.background = 'rgba(0,0,0,0.8)';
    el.style.color = 'white';
    el.style.padding = '8px 12px';
    el.style.marginTop = '8px';
    el.style.borderRadius = '4px';
    el.style.fontFamily = 'sans-serif';
    el.style.fontSize = '13px';
    el.style.maxWidth = '320px';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
    el.style.transition = 'all 0.2s';

    this.container.appendChild(el);
        
        // Handle clicks - either custom handler or auto-open phone
        if (typeof payload.onClick === 'function') {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => payload.onClick(el));
        } else if (payload.openPhone !== false && npcId) {
            // Default: clicking bark opens phone chat with this NPC
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                this.openPhoneChat(payload);
                // Remove bark when clicked
                if (el.parentNode) el.parentNode.removeChild(el);
            });
            
            // Add visual hint that it's clickable
            el.addEventListener('mouseenter', () => {
                el.style.background = 'rgba(74, 158, 255, 0.9)';
                el.style.transform = 'scale(1.05)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.background = 'rgba(0,0,0,0.8)';
                el.style.transform = 'scale(1)';
            });
        }

        setTimeout(() => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        }, duration);
    return el;
  }
  
  async openPhoneChat(payload) {
    const { npcId, npcName, avatar, inkStoryPath, startKnot } = payload;
    
    console.log('📱 Opening phone chat for NPC:', npcId, 'with payload:', payload);
    
    // Get NPC data from manager if available
    let npcData = null;
    if (this.npcManager) {
      npcData = this.npcManager.getNPC(npcId);
      console.log('📋 NPC data from manager:', npcData);
    }

    // Build minigame params
    const params = {
      npcId: npcId,
      npcName: npcName || (npcData && npcData.displayName) || npcId,
      avatar: avatar || (npcData && npcData.avatar),
      inkStoryPath: inkStoryPath || (npcData && npcData.storyPath),
      startKnot: startKnot || (npcData && npcData.currentKnot)
    };
    
    console.log('📱 Final params for phone chat:', params);

    // Try MinigameFramework first (for full game)
    if (window.MinigameFramework && typeof window.MinigameFramework.startMinigame === 'function') {
      window.MinigameFramework.startMinigame('phone-chat', params);
      return;
    }

    // Fallback: try to dynamically load MinigameFramework (only works if Phaser is available)
    if (typeof window.Phaser !== 'undefined') {
      try {
        await import('../minigames/index.js');
        if (window.MinigameFramework && typeof window.MinigameFramework.startMinigame === 'function') {
          window.MinigameFramework.startMinigame('phone-chat', params);
          return;
        }
      } catch (err) {
        console.warn('Failed to load minigames module (Phaser-based):', err);
      }
    }

    // Final fallback: create inline phone UI for testing environments without Phaser
    console.log('Using inline fallback phone UI (no Phaser/MinigameFramework)');
    this.createInlinePhoneUI(params);
  }

  createInlinePhoneUI(params) {
    // Create a simple phone-like chat UI inline
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;

    const phone = document.createElement('div');
    phone.style.cssText = `
      width: 360px; height: 600px; background: #1a1a1a;
      border: 2px solid #333; display: flex; flex-direction: column;
      font-family: sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: #2a2a2a; padding: 16px; border-bottom: 2px solid #333;
      display: flex; align-items: center; justify-content: space-between;
    `;
    header.innerHTML = `
      <span style="color: white; font-weight: bold;">${params.npcName || 'Chat'}</span>
      <button id="phone-close" style="background: #d32f2f; color: white; border: none; padding: 4px 12px; cursor: pointer;">Close</button>
    `;

    // Messages container
    const messages = document.createElement('div');
    messages.id = 'phone-messages';
    messages.style.cssText = `
      flex: 1; overflow-y: auto; padding: 16px; background: #0a0a0a;
    `;

    // Choices container
    const choices = document.createElement('div');
    choices.id = 'phone-choices';
    choices.style.cssText = `
      padding: 12px; background: #1a1a1a; border-top: 2px solid #333;
      display: flex; flex-direction: column; gap: 8px;
    `;

    phone.appendChild(header);
    phone.appendChild(messages);
    phone.appendChild(choices);
    overlay.appendChild(phone);
    document.body.appendChild(overlay);

    // Close handler
    header.querySelector('#phone-close').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // Load and run Ink story
    if (params.inkStoryPath && window.InkEngine) {
      this.runInlineStory(params, messages, choices);
    } else {
      messages.innerHTML = '<div style="color: #999; text-align: center; margin-top: 50%;">No story path provided or InkEngine not loaded</div>';
    }
  }

  async runInlineStory(params, messagesContainer, choicesContainer) {
    try {
      // Fetch story JSON
      const response = await fetch(params.inkStoryPath);
      const storyJson = await response.json();

      // Create engine instance
      const engine = new window.InkEngine();
      engine.loadStory(storyJson);

      // Set NPC name variable if the story supports it
      try {
        engine.setVariable('npc_name', params.npcName || params.npcId);
        console.log('✅ Set npc_name variable to:', params.npcName || params.npcId);
      } catch (e) {
        console.log('⚠️ Story does not have npc_name variable (this is ok)');
      }

      console.log('📖 Story loaded, navigating to knot:', params.startKnot);

      // Navigate to start knot if specified
      if (params.startKnot) {
        engine.goToKnot(params.startKnot);
        console.log('✅ Navigated to knot:', params.startKnot);
      }

      // Display conversation history first
      if (this.npcManager) {
        const history = this.npcManager.getConversationHistory(params.npcId);
        console.log(`📜 Loading ${history.length} messages from history for NPC: ${params.npcId}`);
        console.log('History content:', history);
        
        history.forEach(msg => {
          const msgDiv = document.createElement('div');
          if (msg.type === 'player') {
            msgDiv.style.cssText = `
              background: #4a9eff; color: white; padding: 10px;
              border-radius: 8px; margin-bottom: 8px; max-width: 80%;
              margin-left: auto; text-align: right;
            `;
          } else {
            msgDiv.style.cssText = `
              background: #2a5a8a; color: white; padding: 10px;
              border-radius: 8px; margin-bottom: 8px; max-width: 80%;
            `;
          }
          msgDiv.textContent = msg.text;
          messagesContainer.appendChild(msgDiv);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      // Continue story and render
      const continueStory = (playerChoiceText = null) => {
        console.log('📖 Continuing story...');
        
        // If player made a choice, show it as a player message and record it
        if (playerChoiceText) {
          const playerMsg = document.createElement('div');
          playerMsg.style.cssText = `
            background: #4a9eff; color: white; padding: 10px;
            border-radius: 8px; margin-bottom: 8px; max-width: 80%;
            margin-left: auto; text-align: right;
          `;
          playerMsg.textContent = playerChoiceText;
          messagesContainer.appendChild(playerMsg);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          // Record player choice in history
          if (this.npcManager) {
            this.npcManager.addMessage(params.npcId, 'player', playerChoiceText);
          }
        }
        
        const result = engine.continue();
        
        console.log('Story result:', {
          text: result.text,
          textLength: result.text ? result.text.length : 0,
          choicesCount: result.choices ? result.choices.length : 0,
          canContinue: result.canContinue
        });
        
        // Add NPC message if there's text and record it
        if (result.text && result.text.trim()) {
          const msg = document.createElement('div');
          msg.style.cssText = `
            background: #2a5a8a; color: white; padding: 10px;
            border-radius: 8px; margin-bottom: 8px; max-width: 80%;
          `;
          msg.textContent = result.text.trim();
          messagesContainer.appendChild(msg);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          console.log('✅ Message added:', result.text.trim().substring(0, 50) + '...');
          
          // Record NPC message in history
          if (this.npcManager) {
            this.npcManager.addMessage(params.npcId, 'npc', result.text.trim());
          }
        } else {
          console.warn('⚠️ No text in result');
        }

        // Clear and add choices
        choicesContainer.innerHTML = '';
        if (result.choices && result.choices.length > 0) {
          console.log('✅ Adding', result.choices.length, 'choices');
          result.choices.forEach((choice, index) => {
            const btn = document.createElement('button');
            btn.style.cssText = `
              background: #4a9eff; color: white; border: 2px solid #6ab0ff;
              padding: 10px; cursor: pointer; font-size: 14px;
              transition: background 0.2s;
            `;
            btn.textContent = choice.text;
            btn.addEventListener('mouseenter', () => {
              btn.style.background = '#6ab0ff';
            });
            btn.addEventListener('mouseleave', () => {
              btn.style.background = '#4a9eff';
            });
            btn.addEventListener('click', () => {
              console.log('Choice selected:', index, choice.text);
              engine.choose(index);
              // Pass the choice text so it appears as a player message
              continueStory(choice.text);
            });
            choicesContainer.appendChild(btn);
          });
        } else if (!result.canContinue) {
          // Story ended
          console.log('📕 Story ended');
          const endMsg = document.createElement('div');
          endMsg.style.cssText = 'color: #999; text-align: center; padding: 12px; font-style: italic;';
          endMsg.textContent = '— End of conversation —';
          messagesContainer.appendChild(endMsg);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
          console.log('⚠️ No choices but story can continue');
        }
      };

      continueStory();
    } catch (err) {
      console.error('❌ Failed to run inline story:', err);
      messagesContainer.innerHTML = `<div style="color: #f44; padding: 16px;">Error loading story: ${err.message}</div>`;
    }
  }
}
