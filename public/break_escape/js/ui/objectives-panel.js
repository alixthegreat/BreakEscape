/**
 * ObjectivesPanel
 * 
 * HUD element displaying current mission objectives (top-right).
 * Collapsible panel with aim/task hierarchy.
 * Pixel-art aesthetic with sharp corners and 2px borders.
 * 
 * @module objectives-panel
 */

export class ObjectivesPanel {
  constructor(objectivesManager) {
    this.manager = objectivesManager;
    this.container = null;
    this.content = null;
    this.isCollapsed = false;
    this.isMinimized = false;
    
    this.createPanel();
    this.manager.addListener((aims) => this.render(aims));
    
    // Initial render
    this.render(this.manager.getActiveAims());
  }
  
  createPanel() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'objectives-panel';
    this.container.className = 'objectives-panel';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'objectives-header';
    header.innerHTML = `
      <span class="objectives-title">📋 Objectives</span>
      <div class="objectives-controls">
        <button class="objectives-toggle" aria-label="Toggle objectives" title="Collapse/Expand">▼</button>
      </div>
    `;
    
    // Toggle collapse on header click
    header.querySelector('.objectives-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });
    
    // Also allow clicking the header itself
    header.addEventListener('click', () => {
      this.toggleCollapse();
    });
    
    // Create content area
    this.content = document.createElement('div');
    this.content.className = 'objectives-content';
    
    this.container.appendChild(header);
    this.container.appendChild(this.content);
    document.body.appendChild(this.container);
  }
  
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.container.classList.toggle('collapsed', this.isCollapsed);
    const toggle = this.container.querySelector('.objectives-toggle');
    toggle.textContent = this.isCollapsed ? '▶' : '▼';
  }
  
  render(aims) {
    if (!aims || aims.length === 0) {
      this.content.innerHTML = '<div class="no-objectives">No active objectives</div>';
      return;
    }
    
    let html = '';
    
    aims.forEach(aim => {
      const aimClass = aim.status === 'completed' ? 'aim-completed' : 'aim-active';
      const aimIcon = aim.status === 'completed' ? '✓' : '◆';
      
      html += `
        <div class="objective-aim ${aimClass}" data-aim-id="${aim.aimId}">
          <div class="aim-header">
            <span class="aim-icon">${aimIcon}</span>
            <span class="aim-title">${this.escapeHtml(aim.title)}</span>
          </div>
          <div class="aim-tasks">
      `;
      
      aim.tasks.forEach(task => {
        if (task.status === 'locked') return; // Don't show locked tasks
        
        const taskClass = task.status === 'completed' ? 'task-completed' : 'task-active';
        const taskIcon = task.status === 'completed' ? '✓' : '○';
        
        let progressText = '';
        if (task.showProgress && (task.type === 'collect_items' || task.type === 'submit_flags') && task.status !== 'completed') {
          progressText = ` <span class="task-progress">(${task.currentCount || 0}/${task.targetCount})</span>`;
        }
        
        html += `
          <div class="objective-task ${taskClass}" data-task-id="${task.taskId}">
            <span class="task-icon">${taskIcon}</span>
            <span class="task-title">${this.escapeHtml(task.title)}${progressText}</span>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    this.content.innerHTML = html;
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Highlight a newly completed task with animation
   */
  highlightTask(taskId) {
    const taskEl = this.content.querySelector(`[data-task-id="${taskId}"]`);
    if (taskEl) {
      taskEl.classList.add('new-task');
      setTimeout(() => taskEl.classList.remove('new-task'), 1000);
    }
  }
  
  /**
   * Highlight a newly completed aim with animation
   */
  highlightAim(aimId) {
    const aimEl = this.content.querySelector(`[data-aim-id="${aimId}"]`);
    if (aimEl) {
      aimEl.classList.add('new-objective');
      setTimeout(() => aimEl.classList.remove('new-objective'), 1000);
    }
  }
  
  show() {
    this.container.style.display = 'block';
  }
  
  hide() {
    this.container.style.display = 'none';
  }
  
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.manager.removeListener(this.render);
  }
}

export default ObjectivesPanel;
