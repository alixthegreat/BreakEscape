import { MinigameScene } from '../framework/base-minigame.js';

// ── Node data sourced from planning_notes/.../network_architecture.md ──────────
// Each node: { id, label, sublabel, warn, zone, x, y, w, h, desc, vuln, paths }
// paths: array of attack path IDs (1–5) that pass through this node
// x/y are in the 900×580 SVG viewBox coordinate space

const NODES = [
    // ── Zone 0: Enterprise IT ──────────────────────────────────────────────────
    { id:'INET',      label:'Internet',    sublabel:'Gateway',          warn:false, zone:0, x:30,  y:38,  w:90, h:34, paths:[1,2,3,5],
      desc:'Managed firewall. Entry point from external internet. VPN access routes through here.',
      vuln:null },
    { id:'CORP',      label:'Corporate IT',sublabel:'Enterprise VLAN',  warn:false, zone:0, x:145, y:38,  w:100,h:34, paths:[1,2,3,5],
      desc:'Enterprise network VLAN. Connects all IT systems and provides path to DMZ.',
      vuln:null },
    { id:'AD',        label:'Active',      sublabel:'Directory / DC',   warn:false, zone:0, x:265, y:38,  w:90, h:34, paths:[1,2,3],
      desc:'Domain Controller. Compromised via VPN access in the Albion incident. Controls authentication across enterprise.',
      vuln:'Compromised AD = keys to the kingdom. All enterprise credentials exposed.' },
    { id:'EMAIL',     label:'Email',       sublabel:'Server',           warn:false, zone:0, x:372, y:38,  w:75, h:34, paths:[],
      desc:'Corporate email server. Not directly in attack path but connected to enterprise VLAN.',
      vuln:null },
    { id:'ERP',       label:'ERP',         sublabel:'Business Systems', warn:false, zone:0, x:462, y:38,  w:90, h:34, paths:[],
      desc:'Enterprise resource planning system. Business data. Connected to corporate VLAN.',
      vuln:null },
    { id:'PRINT',     label:'Shared',      sublabel:'Printers ⚠',       warn:true,  zone:0, x:572, y:38,  w:88, h:34, paths:[5],
      desc:'Multi-function printers shared between Albion and Trent Water Services.',
      vuln:'Shared with Trent Water. Lateral movement pathway between two organisations. Not formally risk-assessed.' },
    { id:'FILESHARE', label:'File Server', sublabel:'Albion + Trent Water', warn:true, zone:0, x:674,y:38,  w:110,h:34, paths:[5],
      desc:'Shared file server — used by both Albion Energy and Trent Water Services on same enterprise VLAN.',
      vuln:'Cross-sector data sharing without formal risk assessment. Trent Water compromise could pivot here.' },

    // ── Zone 1: DMZ ────────────────────────────────────────────────────────────
    { id:'JUMP',      label:'Jump Server', sublabel:'Bidirectional RDP ⚠', warn:true, zone:1, x:120, y:148, w:150,h:36, paths:[1],
      desc:'DMZ access server. Configured with bidirectional RDP — intended for engineering remote access.',
      vuln:'ACTIVE SESSION: c.ellison (deprovisioned 8 months ago) connected from Tor exit node since 01:47. This is the primary attack pivot point.' },
    { id:'CASTLETECH',label:'CastleTech', sublabel:'SOC (VPN)',          warn:false, zone:1, x:330, y:148, w:100,h:36, paths:[],
      desc:'Remote security monitoring SOC. Connected via VPN. Contract explicitly excludes OT system monitoring — blind spot.',
      vuln:'Monitoring scope explicitly excludes OT systems. The anomaly was not detected by CastleTech.' },
    { id:'BMS_IT',    label:'Building Mgmt',sublabel:'System',          warn:false, zone:1, x:450, y:148, w:90, h:36, paths:[],
      desc:'Building Management System covering HVAC, fire suppression, and physical access control.',
      vuln:null },

    // ── Zone 2: Level 3 SCADA ─────────────────────────────────────────────────
    { id:'HISTORIAN', label:'Historian',   sublabel:'Dual-Homed ⚠',     warn:true,  zone:2, x:30,  y:254, w:110,h:36, paths:[2],
      desc:'Process historian server. Records all SCADA sensor values over time. Has network interfaces on BOTH enterprise and SCADA networks.',
      vuln:'Dual-homed: one interface on enterprise VLAN, one on SCADA network. Provides passive data relay path that can be repurposed as active OT pivot.' },
    { id:'HMI_OPS',   label:'HMI-OPS-01', sublabel:'Operator WS',      warn:false, zone:2, x:165, y:254, w:100,h:36, paths:[],
      desc:'SCADA operator workstation. Used by control room staff to monitor battery hall status. Password-protected.',
      vuln:null },
    { id:'HMI_ENG',   label:'HMI-ENG-02', sublabel:'Engineering WS',   warn:false, zone:2, x:285, y:254, w:100,h:36, paths:[1,4],
      desc:'Engineering workstation. Accessible from jump server via bidirectional RDP. Also has access to SIS engineering port.',
      vuln:'Reachable from Jump Server via RDP. c.ellison session terminates here. Used to modify SIS setpoints at 03:22.' },
    { id:'SCADA',     label:'SCADA',       sublabel:'Server',           warn:false, zone:2, x:410, y:254, w:90, h:36, paths:[1,2,3,4],
      desc:'Central SCADA server. Polls PLCs every 1–5 seconds. Communicates via Modbus/TCP (no auth, no encryption).',
      vuln:'Reachable via Jump Server, Historian dual-home, and legacy Modbus/TCP firewall rules. Three separate attack paths converge here.' },

    // ── Zone 3: Level 1-2 Control ─────────────────────────────────────────────
    { id:'PLC_BMS',   label:'PLC-BMS',    sublabel:'Battery Mgmt',     warn:false, zone:3, x:60,  y:362, w:90, h:34, paths:[1],
      desc:'Battery Management System PLC. Controls charging/discharging of Racks A1–A4. Communicates via unauthenticated Modbus/TCP.',
      vuln:'No authentication on Modbus/TCP. Any device with SCADA network access can write register values.' },
    { id:'PLC_GRID',  label:'PLC-GRID',   sublabel:'Grid Interface',   warn:false, zone:3, x:170, y:362, w:90, h:34, paths:[],
      desc:'Grid interface PLC. Manages bidirectional power flow to national grid.',
      vuln:null },
    { id:'RTU',       label:'RTUs',       sublabel:'Ancillary Systems', warn:false, zone:3, x:280, y:362, w:90, h:34, paths:[],
      desc:'Remote Terminal Units for ancillary systems. Use DNP3 protocol (basic challenge-response auth, not encrypted).',
      vuln:null },
    { id:'SIS',       label:'SIS',        sublabel:'SIL 2 ⚠',          warn:true,  zone:3, x:390, y:362, w:100,h:34, paths:[4],
      desc:'Safety Instrumented System. Certified SIL 2 under IEC 61511. Has its own sensor inputs and actuator outputs — designed to operate independently of SCADA.',
      vuln:'Engineering port reachable from SCADA network (HMI-ENG-02). No authentication required. Setpoints modified at 03:22 — THERMAL_RUNAWAY_THRESHOLD raised from 55°C to 85°C. Firmware patch available for 18 months — not applied.' },

    // ── Zone 4: Level 0 Field Devices ─────────────────────────────────────────
    { id:'TEMP',      label:'Temp',        sublabel:'Sensors',          warn:false, zone:4, x:30,  y:460, w:75, h:30, paths:[], desc:'Cell thermocouples on each battery rack. Digital readings falsified from 23:12.', vuln:null },
    { id:'VOLT',      label:'Voltage',     sublabel:'/ Current',        warn:false, zone:4, x:120, y:460, w:75, h:30, paths:[], desc:'Voltage and current sensors per rack.', vuln:null },
    { id:'GAS',       label:'H₂ Gas',      sublabel:'Detectors',        warn:false, zone:4, x:210, y:460, w:75, h:30, paths:[], desc:'Hydrogen gas detectors. SIS reads these directly via hardwired connection.', vuln:null },
    { id:'CONTACT',   label:'Contactors',  sublabel:'/ Breakers',       warn:false, zone:4, x:300, y:460, w:80, h:30, paths:[], desc:'DC contactors and AC breakers. Controlled by both PLC-BMS and SIS.', vuln:null },
    { id:'COOL',      label:'Cooling',     sublabel:'Fans / Vents',     warn:false, zone:4, x:395, y:460, w:75, h:30, paths:[], desc:'Cooling fans and ventilation dampers. Also hardwired to ESD interlock.', vuln:null },
    { id:'INV',       label:'Inverters',   sublabel:'Bidirectional',    warn:false, zone:4, x:485, y:460, w:80, h:30, paths:[], desc:'Bidirectional inverters. Controlled by PLC-GRID and RTUs.', vuln:null },

    // ── Zone 5: Independent Safety (Cyber-Immune) ──────────────────────────────
    { id:'ESD',       label:'Hardwired ESD', sublabel:'Pushbutton',     warn:false, zone:5, x:60,  y:530, w:110,h:30, paths:[],
      desc:'Hardwired Emergency Shutdown. Electrically interlocked — completely independent of all networked and programmable systems.',
      vuln:null },
    { id:'ANALOG',    label:'Analog',       sublabel:'Thermometers',    warn:false, zone:5, x:200, y:530, w:100,h:30, paths:[],
      desc:'Wall-mounted analog thermometers. Read actual physical temperature — not connected to any network. Showed 51°C when SCADA reported 28°C.',
      vuln:null },
];

// Trent Water nodes (rendered in right-side subgraph column)
const TW_NODES = [
    { id:'TW_WS',    label:'Trent Water',  sublabel:'Workstations',  warn:false, x:798, y:38,  w:90, h:34, paths:[5],
      desc:'Trent Water Services workstations on Albion enterprise VLAN. Share file server and printers with Albion.', vuln:null },
    { id:'TW_SCADA', label:'Trent Water',  sublabel:'SCADA System',  warn:false, x:798, y:88,  w:90, h:34, paths:[5],
      desc:'Trent Water SCADA system. Logically separate from Albion OT, but reachable via shared enterprise infrastructure.', vuln:null },
];

// ── Attack paths definition ────────────────────────────────────────────────────
const ATTACK_PATHS = {
    1: { label:'Path 1 — Main Pivot', desc:'VPN → AD compromise → Jump Server (dormant RDP) → HMI-ENG-02 → SCADA → PLCs', claim:'EN-001', nodes:['INET','CORP','AD','JUMP','HMI_ENG','SCADA','PLC_BMS'] },
    2: { label:'Path 2 — Historian Bridge', desc:'VPN → AD compromise → Historian dual-home → SCADA', claim:'EN-001', nodes:['INET','CORP','AD','HISTORIAN','SCADA'] },
    3: { label:'Path 3 — Legacy Modbus Rules', desc:'Enterprise VLAN → Legacy firewall Modbus/TCP exceptions → SCADA Server', claim:'EN-001', nodes:['CORP','SCADA'] },
    4: { label:'Path 4 — SIS Reachability', desc:'SCADA network → SIS engineering port (unauthenticated)', claim:'EN-002', nodes:['SCADA','HMI_ENG','SIS'] },
    5: { label:'Path 5 — Cross-Sector', desc:'Shared file server / printers → Trent Water workstations → Trent Water SCADA', claim:'EN-011', nodes:['FILESHARE','PRINT','TW_WS','TW_SCADA'] },
};

// ── Connection lines ───────────────────────────────────────────────────────────
// type: 'normal' | 'boundary' | 'legacy' | 'hardwired' | 'attack' (unused at build; activated dynamically)
// label: short protocol label (optional)
// paths: attack path IDs this line is part of
const LINES = [
    // Enterprise IT internal
    { from:'INET',     to:'CORP',      type:'normal',   paths:[1,2,3,5] },
    { from:'CORP',     to:'AD',        type:'normal',   paths:[1,2,3] },
    { from:'CORP',     to:'EMAIL',     type:'normal',   paths:[] },
    { from:'CORP',     to:'ERP',       type:'normal',   paths:[] },
    { from:'CORP',     to:'PRINT',     type:'normal',   paths:[5] },
    { from:'CORP',     to:'FILESHARE', type:'normal',   paths:[5] },
    { from:'CORP',     to:'BMS_IT',    type:'normal',   paths:[] },
    // Enterprise to DMZ/SCADA
    { from:'CORP',     to:'JUMP',      type:'boundary', paths:[1],   label:'RDP' },
    { from:'CORP',     to:'SCADA',     type:'legacy',   paths:[3],   label:'Modbus/TCP' },
    { from:'CASTLETECH',to:'CORP',     type:'normal',   paths:[],    label:'VPN' },
    // Historian dual-home
    { from:'HISTORIAN',to:'CORP',      type:'legacy',   paths:[2],   label:'dual-home' },
    { from:'HISTORIAN',to:'SCADA',     type:'normal',   paths:[2],   label:'OPC-UA' },
    // Jump server to SCADA zone
    { from:'JUMP',     to:'HMI_ENG',   type:'boundary', paths:[1],   label:'RDP⚠' },
    { from:'JUMP',     to:'SCADA',     type:'boundary', paths:[] },
    // SCADA zone internal
    { from:'HMI_OPS',  to:'SCADA',     type:'normal',   paths:[] },
    { from:'HMI_ENG',  to:'SCADA',     type:'normal',   paths:[1] },
    { from:'HMI_ENG',  to:'SIS',       type:'legacy',   paths:[4],   label:'SIS eng port⚠' },
    // SCADA to PLCs
    { from:'SCADA',    to:'PLC_BMS',   type:'normal',   paths:[1],   label:'Modbus/TCP' },
    { from:'SCADA',    to:'PLC_GRID',  type:'normal',   paths:[] },
    { from:'SCADA',    to:'RTU',       type:'normal',   paths:[],    label:'DNP3' },
    // PLC to field
    { from:'PLC_BMS',  to:'TEMP',      type:'normal',   paths:[] },
    { from:'PLC_BMS',  to:'VOLT',      type:'normal',   paths:[] },
    { from:'PLC_BMS',  to:'CONTACT',   type:'normal',   paths:[] },
    { from:'PLC_BMS',  to:'COOL',      type:'normal',   paths:[] },
    { from:'PLC_GRID', to:'INV',       type:'normal',   paths:[] },
    { from:'SIS',      to:'TEMP',      type:'normal',   paths:[] },
    { from:'SIS',      to:'GAS',       type:'normal',   paths:[] },
    { from:'SIS',      to:'CONTACT',   type:'normal',   paths:[4] },
    { from:'SIS',      to:'COOL',      type:'normal',   paths:[4] },
    { from:'RTU',      to:'INV',       type:'normal',   paths:[] },
    // ESD hardwired
    { from:'ESD',      to:'CONTACT',   type:'hardwired',paths:[],    label:'hardwired' },
    { from:'ESD',      to:'COOL',      type:'hardwired',paths:[],    label:'hardwired' },
    // Trent Water
    { from:'FILESHARE',to:'TW_WS',     type:'normal',   paths:[5] },
    { from:'PRINT',    to:'TW_WS',     type:'normal',   paths:[5] },
    { from:'TW_WS',    to:'TW_SCADA',  type:'normal',   paths:[5] },
];

// ── Zone definitions ───────────────────────────────────────────────────────────
const ZONES = [
    { id:0, label:'LEVEL 4–5 — ENTERPRISE IT NETWORK',      y:18,  h:64,  fill:'#2a0808', stroke:'#7f1d1d' },
    { id:1, label:'DMZ / IT-OT BOUNDARY',                   y:130, h:68,  fill:'#2a1800', stroke:'#92400e' },
    { id:2, label:'LEVEL 3 — OPERATIONS / SCADA NETWORK',   y:236, h:68,  fill:'#1a1500', stroke:'#78650a' },
    { id:3, label:'LEVEL 1–2 — CONTROL NETWORK',            y:344, h:64,  fill:'#08082a', stroke:'#1e3a8a' },
    { id:4, label:'LEVEL 0 — FIELD DEVICES',                y:442, h:60,  fill:'#111111', stroke:'#374151' },
    { id:5, label:'INDEPENDENT SAFETY LAYER — CYBER-IMMUNE',y:514, h:54,  fill:'#061a0a', stroke:'#14532d' },
];

export class NetworkArchitectureMinigame extends MinigameScene {
    constructor(container, params = {}) {
        super(container, {
            ...params,
            title: 'Network Architecture',
            showCancel: true,
            cancelText: 'Close Diagram'
        });
        this._firstOpen   = false;
        this._activeNode  = null;
        this._activePaths = new Set();
        this._svgEl       = null;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────────

    init() {
        super.init();
        if (this.headerElement) this.headerElement.style.display = 'none';
        this.container.classList.add('nad-minigame-container');
        this.gameContainer.classList.add('nad-game-container');
        this.renderLayout();
    }

    start() {
        super.start();
        const alreadySeen = window.gameState?.globalVariables?.network_architecture_reviewed;
        if (!alreadySeen) {
            this._firstOpen = true;
            this.setGlobalAndNotify('network_architecture_reviewed', true);
        }
    }

    // ── Layout ───────────────────────────────────────────────────────────────────

    renderLayout() {
        this.gameContainer.innerHTML = `
<div class="nad-wrap">
  <div class="nad-header">
    <div class="nad-title">ALBION ENERGY STORAGE — NETWORK ARCHITECTURE (PURDUE MODEL)</div>
    <div class="nad-legend">
      <span class="nad-leg-item"><span class="nad-leg-line nad-leg-normal"></span>Intended path</span>
      <span class="nad-leg-item"><span class="nad-leg-line nad-leg-boundary"></span>IT/OT boundary</span>
      <span class="nad-leg-item"><span class="nad-leg-line nad-leg-legacy"></span>Legacy exception ⚠</span>
      <span class="nad-leg-item"><span class="nad-leg-line nad-leg-hardwired"></span>Hardwired interlock</span>
      <span class="nad-leg-item"><span class="nad-leg-line nad-leg-attack"></span>Attack path</span>
    </div>
  </div>
  <div class="nad-body">
    <div class="nad-svg-wrap">
      ${this._buildSVG()}
    </div>
    <div class="nad-detail" id="nad-detail">
      <div class="nad-detail-hint">Click any system node to see details and attack paths</div>
    </div>
  </div>
</div>`;

        this._svgEl = this.gameContainer.querySelector('.nad-svg');
        this._attachNodeListeners();
    }

    _buildSVG() {
        const allNodes = [...NODES, ...TW_NODES];
        const nodeMap  = Object.fromEntries(allNodes.map(n => [n.id, n]));

        // Helper: centre x/y of a node
        const cx = n => n.x + n.w / 2;
        const cy = n => n.y + n.h / 2;

        let lines = '';
        let attackLines = '';

        // Build connection lines
        LINES.forEach((ln, idx) => {
            const a = nodeMap[ln.from];
            const b = nodeMap[ln.to];
            if (!a || !b) return;

            const cls = ln.type === 'legacy'    ? 'nad-line-legacy' :
                        ln.type === 'boundary'  ? 'nad-line-boundary' :
                        ln.type === 'hardwired' ? 'nad-line-hardwired' :
                                                  'nad-line-normal';
            const pathAttr = ln.paths.length ? `data-paths="${ln.paths.join(',')}"` : '';
            const dashAttr = (ln.type === 'legacy') ? 'stroke-dasharray="7 4"' : '';

            // Base line (always visible)
            lines += `<line class="nad-line ${cls}" ${pathAttr} x1="${cx(a)}" y1="${cy(a)}" x2="${cx(b)}" y2="${cy(b)}" ${dashAttr}/>`;

            // Attack overlay line (hidden initially, shown when path is activated)
            if (ln.paths.length) {
                attackLines += `<line class="nad-line-attack" data-paths="${ln.paths.join(',')}" x1="${cx(a)}" y1="${cy(a)}" x2="${cx(b)}" y2="${cy(b)}"/>`;
            }

            // Inline protocol label if present
            if (ln.label) {
                const mx = (cx(a) + cx(b)) / 2;
                const my = (cy(a) + cy(b)) / 2 - 5;
                lines += `<text class="nad-line-label" x="${mx}" y="${my}">${ln.label}</text>`;
            }
        });

        // Build zone backgrounds
        let zones = '';
        ZONES.forEach(z => {
            zones += `<rect class="nad-zone" x="8" y="${z.y}" width="780" height="${z.h}" fill="${z.fill}" stroke="${z.stroke}" stroke-width="1"/>`;
            zones += `<text class="nad-zone-label" x="14" y="${z.y + 11}">${z.label}</text>`;
        });

        // Trent Water subgraph box
        zones += `<rect class="nad-zone" x="786" y="18" width="102" height="110" fill="#0d1a0d" stroke="#14532d" stroke-width="1"/>`;
        zones += `<text class="nad-zone-label" x="792" y="29">TRENT WATER</text>`;
        zones += `<text class="nad-zone-label" x="792" y="40">SERVICES</text>`;

        // Build nodes
        let nodes = '';
        [...NODES, ...TW_NODES].forEach(n => {
            const hasWarn = n.warn;
            const zoneCls = n.zone === 5 ? 'nad-node-safe' :
                            (n.zone === 0 || n.zone === 1) ? 'nad-node-it' : 'nad-node-ot';
            const warnBadge = hasWarn ? `<text class="nad-node-warn" x="${n.x + n.w - 6}" y="${n.y + 10}">⚠</text>` : '';

            nodes += `
<g class="nad-node ${zoneCls}" id="nad-${n.id}" data-id="${n.id}" style="cursor:pointer" role="button" tabindex="0">
  <rect class="nad-node-rect" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="2"/>
  <text class="nad-node-label" x="${n.x + n.w/2}" y="${n.y + (n.sublabel ? 14 : 20)}">${n.label}</text>
  ${n.sublabel ? `<text class="nad-node-sub" x="${n.x + n.w/2}" y="${n.y + 26}">${n.sublabel}</text>` : ''}
  ${warnBadge}
</g>`;
        });

        return `
<svg class="nad-svg" viewBox="0 0 900 572" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="nad-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#ef4444"/>
    </marker>
  </defs>
  ${zones}
  <g class="nad-lines">${lines}</g>
  <g class="nad-attack-lines">${attackLines}</g>
  <g class="nad-nodes">${nodes}</g>
</svg>`;
    }

    // ── Interaction ──────────────────────────────────────────────────────────────

    _attachNodeListeners() {
        const allNodes = [...NODES, ...TW_NODES];
        allNodes.forEach(n => {
            const el = this.gameContainer.querySelector(`#nad-${n.id}`);
            if (el) {
                this.addEventListener(el, 'click', () => this._onNodeClick(n.id));
                this.addEventListener(el, 'keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') this._onNodeClick(n.id);
                });
            }
        });
    }

    _onNodeClick(nodeId) {
        const allNodes = [...NODES, ...TW_NODES];
        const node = allNodes.find(n => n.id === nodeId);
        if (!node) return;

        // Deselect previous
        if (this._activeNode) {
            const prev = this.gameContainer.querySelector(`#nad-${this._activeNode}`);
            if (prev) prev.classList.remove('nad-node-selected');
        }

        // Select new
        this._activeNode = nodeId;
        const el = this.gameContainer.querySelector(`#nad-${nodeId}`);
        if (el) el.classList.add('nad-node-selected');

        // Determine active paths
        this._activePaths = new Set(node.paths || []);
        this._updateAttackLines();
        this._renderDetail(node);
    }

    _updateAttackLines() {
        const lines = this.gameContainer.querySelectorAll('.nad-line-attack');
        lines.forEach(l => {
            const linePaths = (l.dataset.paths || '').split(',').map(Number);
            const active = linePaths.some(p => this._activePaths.has(p));
            l.classList.toggle('nad-path-active', active);
        });

        // Also highlight involved base lines
        const baseLines = this.gameContainer.querySelectorAll('.nad-line[data-paths]');
        baseLines.forEach(l => {
            const linePaths = (l.dataset.paths || '').split(',').map(Number);
            const active = linePaths.some(p => this._activePaths.has(p));
            l.classList.toggle('nad-line-in-path', active);
        });

        // Dim uninvolved nodes
        const allNodeEls = this.gameContainer.querySelectorAll('.nad-node');
        allNodeEls.forEach(el => {
            const nid = el.dataset.id;
            const n = [...NODES, ...TW_NODES].find(x => x.id === nid);
            if (!n) return;
            const inAnyActivePath = (n.paths || []).some(p => this._activePaths.has(p));
            const isSelected = nid === this._activeNode;
            el.classList.toggle('nad-node-dim', !inAnyActivePath && !isSelected && this._activePaths.size > 0);
        });
    }

    _renderDetail(node) {
        const detail = this.gameContainer.querySelector('#nad-detail');
        if (!detail) return;

        // Find attack paths through this node
        const pathEntries = node.paths
            .map(pid => ATTACK_PATHS[pid])
            .filter(Boolean)
            .map(p => `<div class="nad-detail-path"><span class="nad-path-label">${p.label}</span> <span class="nad-path-claim">[${p.claim}]</span><div class="nad-path-desc">${p.desc}</div></div>`)
            .join('');

        const vulnHtml = node.vuln
            ? `<div class="nad-detail-vuln"><span class="nad-detail-vuln-badge">⚠ VULNERABILITY</span><div class="nad-detail-vuln-text">${node.vuln}</div></div>`
            : '';

        detail.innerHTML = `
<div class="nad-detail-name">${node.label}${node.sublabel ? ' — ' + node.sublabel : ''}</div>
<div class="nad-detail-desc">${node.desc}</div>
${vulnHtml}
${pathEntries ? '<div class="nad-detail-paths-title">ATTACK PATHS THROUGH THIS NODE:</div>' + pathEntries : '<div class="nad-detail-no-paths">No attack paths through this node.</div>'}`;
    }

    // ── Global state ──────────────────────────────────────────────────────────────

    setGlobalAndNotify(name, value) {
        if (window.npcManager?.setGlobalVariable) {
            window.npcManager.setGlobalVariable(name, value);
            return;
        }
        const oldValue = window.gameState?.globalVariables?.[name];
        if (window.gameState?.globalVariables) {
            window.gameState.globalVariables[name] = value;
        }
        window.npcConversationStateManager?.broadcastGlobalVariableChange(name, value, null);
        window.eventDispatcher?.emit(`global_variable_changed:${name}`, { name, value, oldValue });
    }

    cleanup() {
        super.cleanup();
    }
}
