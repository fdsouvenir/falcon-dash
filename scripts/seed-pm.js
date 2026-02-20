#!/usr/bin/env node

/**
 * Seed the PM database with realistic mock data for UI stress testing.
 *
 * Usage: node scripts/seed-pm.js
 *
 * Populates: 4 domains, 11 focuses, ~22 projects, ~120 tasks/subtasks,
 *            ~20 comments, ~25 activities, and task dependency blocks.
 *
 * Inspired by real workspace data — long descriptions to stress test
 * the task detail panel, description expand, and table layouts.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const DB_PATH = join(homedir(), '.openclaw', 'data', 'pm.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

/** Returns a unix timestamp `daysAgo` days in the past */
function ago(daysAgo) {
	return NOW - daysAgo * DAY;
}

/** Returns a date string `daysFromNow` days from now (negative = past) */
function dateStr(daysFromNow) {
	const d = new Date((NOW + daysFromNow * DAY) * 1000);
	return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Clear existing data (dependency order)
// ---------------------------------------------------------------------------

console.log('Clearing existing PM data...');
db.exec(`
	DELETE FROM pm_search;
	DELETE FROM sync_mappings;
	DELETE FROM attachments;
	DELETE FROM activities;
	DELETE FROM comments;
	DELETE FROM blocks;
	DELETE FROM tasks;
	DELETE FROM projects;
	DELETE FROM milestones;
	DELETE FROM focuses;
	DELETE FROM domains;
`);

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

const domains = [
	{
		id: 'fredbot-hosting',
		name: 'Fredbot Hosting',
		description: 'Fredbot Hosting, LLC — managed AI agent hosting platform',
		sort_order: 0
	},
	{
		id: 'fredbot-internal',
		name: 'Fredbot Internal',
		description: 'Internal tooling, integrations, and agent improvements',
		sort_order: 1
	},
	{
		id: 'personal',
		name: 'Personal',
		description: 'Personal life — finance, health, fitness, travel',
		sort_order: 2
	},
	{
		id: 'falcon-dash',
		name: 'Falcon Dash',
		description: 'Web dashboard for the OpenClaw AI platform',
		sort_order: 3
	}
];

const insertDomain = db.prepare(
	'INSERT INTO domains (id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
);
for (const d of domains) {
	insertDomain.run(d.id, d.name, d.description, d.sort_order, ago(60));
}
console.log(`  Domains: ${domains.length}`);

// ---------------------------------------------------------------------------
// Focuses
// ---------------------------------------------------------------------------

const focuses = [
	// Fredbot Hosting
	{
		id: 'business-ops',
		domain_id: 'fredbot-hosting',
		name: 'Business Operations',
		description: 'Accounting, banking, legal, insurance, LLC setup',
		sort_order: 0
	},
	{
		id: 'hosting-frontend',
		domain_id: 'fredbot-hosting',
		name: 'Frontend',
		description: 'Website, branding, lead capture, SEO, social presence',
		sort_order: 1
	},
	{
		id: 'backend-infra',
		domain_id: 'fredbot-hosting',
		name: 'Backend Infrastructure',
		description: 'Customer provisioning, monitoring, deployment, production readiness',
		sort_order: 2
	},
	// Fredbot Internal
	{
		id: 'integrations',
		domain_id: 'fredbot-internal',
		name: 'Integrations',
		description: 'Third-party integrations (Google, CRM, etc.)',
		sort_order: 0
	},
	{
		id: 'core-improvements',
		domain_id: 'fredbot-internal',
		name: 'Core Improvements',
		description: 'Multi-agent orchestration, skill system, model routing',
		sort_order: 1
	},
	// Personal
	{
		id: 'finance',
		domain_id: 'personal',
		name: 'Finance',
		description: 'Taxes, accounting, investments',
		sort_order: 0
	},
	{
		id: 'fitness',
		domain_id: 'personal',
		name: 'Fitness',
		description: 'Gym, running, wellness',
		sort_order: 1
	},
	{
		id: 'health',
		domain_id: 'personal',
		name: 'Health',
		description: 'Medical appointments, referrals',
		sort_order: 2
	},
	{
		id: 'travel',
		domain_id: 'personal',
		name: 'Travel',
		description: 'Road trips, events, vacations',
		sort_order: 3
	},
	// Falcon Dash
	{
		id: 'ui-ux',
		domain_id: 'falcon-dash',
		name: 'UI/UX',
		description: 'Dashboard interface design and usability improvements',
		sort_order: 0
	},
	{
		id: 'architecture',
		domain_id: 'falcon-dash',
		name: 'Architecture',
		description: 'Gateway protocol, canvas bridge, store layer, server-side',
		sort_order: 1
	}
];

const insertFocus = db.prepare(
	'INSERT INTO focuses (id, domain_id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
for (const f of focuses) {
	insertFocus.run(f.id, f.domain_id, f.name, f.description, f.sort_order, ago(60));
}
console.log(`  Focuses: ${focuses.length}`);

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

const milestones = [
	{ name: 'Q1 2026', due_date: '2026-03-31', description: 'End of Q1 targets' },
	{ name: 'Q2 2026', due_date: '2026-06-30', description: 'End of Q2 targets' },
	{
		name: 'Website Go Live!',
		due_date: '2026-04-15',
		description: 'Fredbot Hosting marketing site launch'
	},
	{
		name: 'Onboarding Flow Go Live!',
		due_date: '2026-05-01',
		description: 'Customer self-service onboarding launch'
	}
];

const insertMilestone = db.prepare(
	'INSERT INTO milestones (name, due_date, description, created_at) VALUES (?, ?, ?, ?)'
);
const milestoneIds = [];
for (const m of milestones) {
	const info = insertMilestone.run(m.name, m.due_date, m.description, ago(55));
	milestoneIds.push(info.lastInsertRowid);
}
console.log(`  Milestones: ${milestones.length}`);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const projects = [
	// --- P0: Backend Infrastructure ---
	{
		focus_id: 'backend-infra',
		title: 'Infrastructure Deployment — Progress Tracker',
		description: `Multi-phase infrastructure deployment for the Fredbot Hosting platform. Tracks provisioning of control-01 server, Cloudflare Workers, Twenty CRM integration, Tailscale mesh networking, and Hetzner cloud resources.

Server: control-01 at 100.105.62.30 (Tailscale) / Hetzner VPS
Credentials: /root/.fredbot-secrets (SSH key, API tokens, service accounts)
Cloudflare: Portal at app.fredbot.hosting, Customer Portal Worker deployed

Phase 1 (Immediate Deployment): SSH access via Tailscale, credential storage, Cloudflare service token, task queue verification.
Phase 2 (Cloudflare): Portal Access Application, Customer Portal Worker, DNS configuration.
Phase 3 (Twenty CRM): Customer Object schema (email, companyName, customerStatus, agentSlug, serverIp, tailscaleHostname, onboardedAt), Support Task Object (title, description, priority, taskStatus, claimedAt, lastHeartbeat, completedAt, result, errorLog), webhooks, API access.
Phase 4 (Tailscale): Mesh networking between control-01 and elitebook (100.67.63.119), ACL policy, auth key with tag:agent at /run/secrets/tailscale-authkey.
Phase 5 (Hetzner): hcloud CLI on control-01, contexts for fredbot-infra and fredbot-customers, SSH key fredbot-provisioner.
Phase 6 (Support Queue): Scripts at /opt/fredbot/, cron jobs, test support task.`,
		status: 'done',
		priority: 'urgent',
		due_date: dateStr(-3),
		milestone_id: milestoneIds[0],
		created_ago: 45
	},

	// --- P1: Production Readiness ---
	{
		focus_id: 'backend-infra',
		title: 'Production Readiness',
		description: `Ensure the Fredbot Hosting infrastructure is production-grade with monitoring, backups, documentation, and security hardening.

Goals:
- Monitoring & alerting in place (Netdata, email/Slack notifications)
- Backup & recovery tested (PostgreSQL daily backups, 7-day retention)
- Documentation & runbooks complete (/opt/fredbot/OPERATIONS.md, RESTORE.md)
- Security hardening done (fail2ban, UFW, SSH lockdown)

Phase 7.1 — Monitoring: Netdata alerts for CPU (warn 80%, crit 95%), memory (warn 85%, crit 95%), disk (warn 80%, crit 90%). Logs aggregated at /var/log/fredbot/. Email/Slack notifications deferred pending SMTP config.

Phase 7.2 — Backups: PostgreSQL backup script at /opt/fredbot/backup-postgres.sh, daily at 2 AM, 7-day retention. Restore procedure at /opt/fredbot/RESTORE.md. Test backup verified (117K).

Phase 7.3 — Documentation: Operations runbook at /opt/fredbot/OPERATIONS.md covering server access, daily/weekly checklists, troubleshooting, emergency procedures.

Phase 7.5 — Security: fail2ban with 678 total bans, UFW firewall (ports 22/SSH and 19999/Netdata only), SSH hardening (PermitRootLogin prohibit-password, PasswordAuthentication no, MaxAuthTries 3), file permissions audited.`,
		status: 'in_progress',
		priority: 'high',
		due_date: dateStr(5),
		milestone_id: milestoneIds[0],
		created_ago: 30
	},

	// --- P2: Competitive Intelligence ---
	{
		focus_id: 'business-ops',
		title: 'Competitive Intelligence Monitoring',
		description: `Track competitors and copycats in the AI agent hosting space. Daily automated research via cron job monitors WHOIS records, website changes, social media presence, and ownership changes.

Known Competitors:
- clawdhost.net — Active, $25/mo managed hosting
- clawdhost.xyz — Active, $10-20/mo, Telegram-focused, operated by Corentin at ScaleRocket
- clawdbot.host — Parked, GoDaddy parking page (likely squatter)
- openclaw.host — Active, multilingual managed cloud hosting
- openclawd.ai — Monitor, press releases Jan 31 with brand confusion potential
- xcloud.host/openclaw-hosting — NEW, $24/mo managed hosting by WPDeveloper parent company
- cloudflare/moltworker — MAJOR THREAT, free hosting via Cloudflare Workers, eliminates hosting cost entirely

Process: Automated daily scans check domain registration changes, pricing updates, new feature announcements, and social media activity. Results compiled into weekly intelligence brief for strategic planning.

Risk Assessment: The Cloudflare Workers approach (moltworker) represents the biggest competitive threat because it eliminates the hosting cost entirely. Our differentiation must focus on managed services, support quality, and ease of onboarding rather than competing on price alone.`,
		status: 'in_progress',
		priority: 'high',
		due_date: null,
		created_ago: 20
	},

	// --- P3: Unified Channel Dashboard ---
	{
		focus_id: 'backend-infra',
		title: 'Unified Channel Dashboard',
		description: `Build unified dashboard UI for multiple conversation surfaces (Discord, Slack, Web). One bot, multiple interfaces — should feel like the same bot regardless of surface.

Vision:
- Bidirectional sync: create a channel in the dashboard and it appears in Discord/Slack
- Rich features beyond Discord/Slack capabilities (canvas, dynamic widgets, A2UI)
- Surface-agnostic channels as first-class concept

Architecture:
OpenClaw Sessions (Source of Truth)
├── proj1, general, ... (named persistent sessions)
└── syncs to:
    ├── Discord Surface
    ├── Dashboard Surface (Falcon Dash)
    └── Slack Surface

Key Components:
- Session Registry: named, persistent sessions with metadata (label, created_at, last_activity)
- Session API: list, create, rename, delete operations via gateway protocol
- Surface Adapters: per-platform message formatting and delivery
- Sync Engine: bidirectional state reconciliation between surfaces

Completed Phases: Project Setup, Core Infrastructure, Core UI Components, Rich Content Rendering, Real-time Features, Session Management, Interactive Features, Notifications, PWA Support.
Remaining: Polish & QA, Search & Navigation.`,
		status: 'in_progress',
		priority: 'normal',
		due_date: dateStr(21),
		milestone_id: milestoneIds[1],
		created_ago: 50
	},

	// --- P4: LLC Formation ---
	{
		focus_id: 'business-ops',
		title: 'LLC Formation & Registration',
		description:
			'Register Fredbot Hosting, LLC. File articles of organization, obtain EIN, set up registered agent service. State: Delaware (for flexibility) with foreign qualification in Illinois (operating state).',
		status: 'todo',
		priority: 'high',
		due_date: dateStr(14),
		created_ago: 25
	},

	// --- P5: Website / Landing Page ---
	{
		focus_id: 'hosting-frontend',
		title: 'Website / Landing Page',
		description:
			'Build www.fredbot.hosting marketing site. Conversion-optimized landing page with hero section, feature highlights, pricing table, testimonials, and CTA. Mobile-first responsive design. Deploy on Cloudflare Pages.',
		status: 'todo',
		priority: 'high',
		due_date: dateStr(45),
		milestone_id: milestoneIds[2],
		created_ago: 20
	},

	// --- P6: Branding / Logo ---
	{
		focus_id: 'hosting-frontend',
		title: 'Branding / Logo',
		description:
			'Design Fredbot Hosting brand identity and logo. Color palette, typography, logo variants (full, icon, monochrome). Deliverables: SVG logo files, brand guidelines PDF, social media profile images.',
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(30),
		created_ago: 18
	},

	// --- P7: SEO / Content ---
	{
		focus_id: 'hosting-frontend',
		title: 'SEO / Content Strategy',
		description:
			'Content strategy for organic growth. Blog posts targeting "AI agent hosting", "managed Claude hosting", "OpenClaw hosting" keywords. SEO audit, sitemap, meta tags, structured data markup.',
		status: 'todo',
		priority: 'low',
		due_date: dateStr(60),
		created_ago: 15
	},

	// --- P8: Social Presence ---
	{
		focus_id: 'hosting-frontend',
		title: 'Social Presence',
		description:
			'Set up and maintain social media profiles. Twitter/X (@FredbotHosting), LinkedIn company page, Discord community server. Content calendar for launch announcements and engagement.',
		status: 'todo',
		priority: 'low',
		due_date: null,
		created_ago: 15
	},

	// --- P9: Insurance ---
	{
		focus_id: 'business-ops',
		title: 'Business Liability Insurance',
		description:
			'Obtain business liability insurance for Fredbot Hosting, LLC. General liability + professional liability (E&O). Research providers: Hiscox, Next Insurance, Hartford. Target: $1M coverage.',
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(45),
		created_ago: 15
	},

	// --- P10: Accounting Setup ---
	{
		focus_id: 'business-ops',
		title: 'Accounting Setup',
		description:
			'Set up accounting system for Fredbot Hosting. Wave or QuickBooks Self-Employed. Chart of accounts, expense categories, invoice templates, tax categorization. Connect business bank account when available.',
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(30),
		created_ago: 12
	},

	// --- P11: Tax Resolution & Filing ---
	{
		focus_id: 'finance',
		title: 'Tax Resolution & Filing',
		description: `Resolve back taxes and file current year (2025). Two separate tracks running in parallel:

Track 1 — Current Year Filing (Scott, CPA):
Gather all tax documents: W-2s, 1099s (freelance, interest, dividends), mortgage interest (1098), property tax receipts, charitable donation receipts, medical expense records. Scott handles preparation and e-filing. Deadline: April 15, 2026.

Track 2 — Back Tax Settlement (Michael C. Whelan JD CPA):
Michael is a former IRS attorney now at whelantax.com. Handling settlement negotiation for outstanding balance. Need to provide: prior year returns, payment history, current financial statement, asset disclosure. Watch for emails from @whelantax.com.

Important Contacts:
- Scott (CPA, current year): 312-555-0147
- Michael C. Whelan JD CPA (back taxes): whelantax.com, 312-555-0293
- IRS Taxpayer Advocate: 877-777-4778 (if settlement stalls)`,
		status: 'in_progress',
		priority: 'urgent',
		due_date: dateStr(-13),
		created_ago: 40
	},

	// --- P12: Sign Up for Gym ---
	{
		focus_id: 'fitness',
		title: 'Sign Up for West Town Athletic Club',
		description: `Join West Loop Athletic Club (part of Chicago Athletic Clubs network).

Location: 1380 W Randolph St, Chicago, IL 60607 (Randolph & Ogden)
Phone: (312) 850-4667
Distance from home (2432 W Chicago Ave): 1.5 miles / 7 min drive

Hours:
- Mon-Thu: 5:30am - 9:00pm
- Fri: 5:30am - 8:00pm
- Sat-Sun: 7:00am - 7:00pm

Pricing:
- All-Access (7 locations): ~$84/month
- Single location: ~$74-79/month
- Current Promo: $0 enrollment + 1 month free (ENDED 2/16/2026 — check for new promos)

Amenities:
- 82-foot indoor lap pool
- Sauna & steam room
- Weekly group fitness (yoga, pilates, cycling, zumba, barre, rowing)
- Weight room, functional training area, cardio equipment
- Personal training, luxury lockers, full towel service, WiFi

Why West Loop: Has sauna AND pool (will use both). Complements cold plunge routine for contrast therapy. 7 CAC locations citywide if I want to visit others.`,
		status: 'todo',
		priority: 'high',
		due_date: dateStr(-3),
		created_ago: 18
	},

	// --- P13: Medical Referrals ---
	{
		focus_id: 'health',
		title: 'Schedule Medical Referrals (Allergy & PT)',
		description: `Two referrals from Joy Li, PA-C at Northwestern Medicine that need to be scheduled:

1. Allergy & Immunology
   - Phone: 312-695-8624 (Downtown Chicago location)
   - Referral order date: November 7, 2025
   - Reason: seasonal allergies not responding to OTC antihistamines, possible immunotherapy evaluation
   - Insurance: Blue Cross PPO, no prior auth needed for initial consult

2. Physical Therapy
   - Phone: (630) 933-1500
   - Referral order date: October 21, 2025
   - Reason: chronic lower back pain, sciatica symptoms
   - Note: find location closest to home (Ukrainian Village area)
   - Insurance: covered at 80% after deductible, 30 visits/year

Both referrals are several months old — call soon before they expire (typically valid 90-180 days depending on provider).`,
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(7),
		created_ago: 14
	},

	// --- P14: Road Trip ---
	{
		focus_id: 'travel',
		title: 'Vegas, Tahoe & Palm Springs Road Trip',
		description: `March 18-29 multi-stop road trip. Driving from Chicago with the dog (Penny).

Itinerary:
- March 18-20: Las Vegas (3 nights)
- March 21: Drive Vegas → South Lake Tahoe / Heavenly Ski Resort (meet Brian Plotkin)
- March 22-23: Skiing at Heavenly (2 days)
- March 24: Drop Brian off in Reno, begin drive south
- March 24-25: Drive Reno → Palm Springs (overnight stop TBD, maybe Bakersfield or Barstow)
- March 26-29: Palm Springs (4 nights, Shari booked AirBnB)

Lodging:
- Vegas: booked (confirmation TBD)
- Tahoe: Hotel options in South Lake Tahoe — ★5.0 (1BR, 2 beds) or ★4.71 (1BR, 2 beds), both under $200/night
- Palm Springs: AirBnB booked by Shari, need details/confirmation

Dog Care:
- Penny needs boarding March 18-21 (Vegas) and March 26-29 (Palm Springs)
- Research pet-friendly hotels for driving days
- Pack: food, bowls, leash, crate, vet records

Driving Legs:
1. Chicago → Vegas: ~1,750 miles, 2 days (overnight in Kansas City or Denver)
2. Vegas → Tahoe: ~450 miles, 7 hours
3. Tahoe → Reno: 45 miles, 1 hour
4. Reno → Palm Springs: ~500 miles, 8 hours
5. Palm Springs → Chicago: ~1,900 miles, 2 days (overnight in Amarillo or OKC)`,
		status: 'in_progress',
		priority: 'high',
		due_date: dateStr(27),
		created_ago: 30
	},

	// --- P15: Bachelor Party ---
	{
		focus_id: 'travel',
		title: "Kyle Borchardt's Bachelor Party",
		description: `Bachelor party in Big Sky, Montana. July 16-19, 2026.

Organizer: Jeff Nelson (jeffnelson16@gmail.com)
Deposit: $500 due by end of February 2026
Flights: ORD → Bozeman Yellowstone International (BZN), coordinate arrival times with group

Activities:
- Whitewater rafting on the Gallatin River
- ATV riding in the mountains
- PBR Championship weekend (Professional Bull Riding event in Big Sky)
- Possibly shooting (guns, skeet/trap)

Accommodation: shared rental house in Big Sky (included in deposit)

Budget Estimate:
- Flight: ~$350-500 round trip
- Deposit: $500 (covers accommodation + activities)
- Food/drinks: ~$300-400
- Total: ~$1,200-1,400`,
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(9),
		created_ago: 20
	},

	// --- P16: Google Contacts Sync ---
	{
		focus_id: 'integrations',
		title: 'Google Contacts Sync & Cleanup',
		description: `Sync contacts between personal (fdsouvenir@gmail.com) and work (fred@fdsconsulting.com) Google accounts. Both accounts have People API access configured with read/write scopes enabled.

Phase 1: Audit — export contacts from both accounts, diff to find duplicates, orphans, and conflicts.
Phase 2: Cleanup — review diff results, delete unused contacts, merge duplicates, standardize formats.
Phase 3: Architecture — design bi-directional sync tool (consider Google Apps Script vs standalone Node.js service vs cron job).
Phase 4: Build — implement sync with conflict resolution (last-modified wins, with manual review queue for conflicts).`,
		status: 'todo',
		priority: 'low',
		due_date: null,
		created_ago: 25
	},

	// --- P17: Multi-Agent Orchestration ---
	{
		focus_id: 'core-improvements',
		title: 'oh-my-clawdbot: Multi-Agent Orchestration',
		description: `Build multi-agent orchestration skill for Clawdbot. Route tasks to specialized agents based on capabilities, cost constraints, and task complexity.

Architecture:
- Skill structure within existing Clawdbot skill system
- Agent registry with capability declarations (tools, models, context windows)
- Model routing logic: fast/cheap (Haiku) for simple tasks, powerful (Opus) for complex reasoning
- Orchestration engine: task decomposition, agent selection, result aggregation
- Execution modes: sequential, parallel, pipeline, fan-out/fan-in
- Natural language routing: "research this" → research agent, "write code for" → coding agent
- Verification protocol: output validation, retry with different agent on failure

Phases:
1. Create skill structure and registration
2. Port existing agent definitions to registry format
3. Implement model routing logic with cost awareness
4. Build orchestration engine with execution modes
5. Implement parallel execution with result merging
6. Add natural language intent classification for routing
7. Build verification protocol with retry logic
8. Testing and documentation`,
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(60),
		created_ago: 15
	},

	// --- P18: PM Dashboard Redesign ---
	{
		focus_id: 'ui-ux',
		title: 'PM Dashboard Redesign',
		description: `Overhaul the project management UI in Falcon Dash. Three phases:

1. ProjectList: stat cards (Total/Active/Due Soon/Overdue), attention chips, filter pills (Active/All/Done/Archived), projects grouped by Domain → Focus with collapsible domain headers. Status pills, priority tags, smart due date formatting.

2. ProjectDetail: compact toolbar header with breadcrumb + status/priority badges. Task table with status pill, priority tag (high/urgent only), due date column with urgency coloring. Expandable subtasks. Tabs for Tasks, Comments, Activity.

3. TaskDetailPanel: right-side panel (500px desktop, full mobile) with back arrow, ancestry breadcrumb, subtask list, priority badges. Full task body display with markdown rendering.`,
		status: 'in_progress',
		priority: 'high',
		due_date: dateStr(3),
		created_ago: 14
	},

	// --- P19: Gateway Canvas Bridge ---
	{
		focus_id: 'architecture',
		title: 'Gateway Canvas Bridge Plugin',
		description: `Standalone OpenClaw gateway plugin that bridges operators into the canvas pipeline. Registers operators as virtual canvas nodes so the agent's node.list/node.invoke flow can route canvas commands to the dashboard.

Methods:
- canvas.bridge.register — registers calling operator as virtual canvas node via nodeRegistry.register() with synthetic role: "node" client
- canvas.bridge.invokeResult — proxies invoke results to nodeRegistry.handleInvokeResult(), bypassing NODE_ROLE_METHODS authorization
- canvas.bridge.unregister — explicit cleanup via nodeRegistry.unregister()

Build: cd openclaw-canvas-bridge && npm install && npm run build
Install: openclaw plugins install ./openclaw-canvas-bridge (then restart gateway)`,
		status: 'review',
		priority: 'normal',
		due_date: dateStr(1),
		created_ago: 21
	},

	// --- P20: Lead Capture ---
	{
		focus_id: 'hosting-frontend',
		title: 'Lead Capture System',
		description:
			'Build lead capture forms, email list integration, and CRM pipeline. Embed signup form on landing page, connect to Twenty CRM customer object. Automated welcome email sequence via Resend or SendGrid.',
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(50),
		milestone_id: milestoneIds[3],
		created_ago: 10
	},

	// --- P21: Legal / Contracts ---
	{
		focus_id: 'business-ops',
		title: 'Legal / Contracts',
		description:
			'Draft customer contracts, Terms of Service, and Privacy Policy for Fredbot Hosting. Research SaaS contract templates, consult attorney for review. Need: MSA, SLA with uptime guarantees, acceptable use policy, data processing agreement (DPA) for GDPR compliance.',
		status: 'todo',
		priority: 'normal',
		due_date: dateStr(45),
		created_ago: 15
	}
];

const insertProject = db.prepare(`
	INSERT INTO projects (focus_id, title, description, status, priority, due_date, milestone_id, created_at, updated_at, last_activity_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const projectIds = [];
for (const p of projects) {
	const created = ago(p.created_ago);
	const updated = ago(Math.max(0, p.created_ago - 3));
	const info = insertProject.run(
		p.focus_id,
		p.title,
		p.description,
		p.status,
		p.priority,
		p.due_date,
		p.milestone_id ?? null,
		created,
		updated,
		updated
	);
	projectIds.push(Number(info.lastInsertRowid));
}
console.log(`  Projects: ${projects.length}`);

// ---------------------------------------------------------------------------
// Tasks & Subtasks
// ---------------------------------------------------------------------------

const insertTask = db.prepare(`
	INSERT INTO tasks (parent_project_id, parent_task_id, title, body, status, priority, due_date, sort_order, created_at, updated_at, last_activity_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let taskCount = 0;
const taskIds = {};

function addTask(
	key,
	{ projectIdx, parentKey, title, body, status, priority, due_date, sort_order, created_ago: ca }
) {
	const created = ago(ca);
	const updated = ago(Math.max(0, ca - 2));
	const info = insertTask.run(
		parentKey ? null : projectIds[projectIdx],
		parentKey ? taskIds[parentKey] : null,
		title,
		body ?? null,
		status ?? 'todo',
		priority ?? 'normal',
		due_date ?? null,
		sort_order ?? 0,
		created,
		updated,
		updated
	);
	taskIds[key] = Number(info.lastInsertRowid);
	taskCount++;
}

// =========================================================================
// P0: Infrastructure Deployment (6 phase tasks with long bodies + subtasks)
// =========================================================================

addTask('infra-p1', {
	projectIdx: 0,
	title: 'Phase 1: Immediate Deployment',
	body: `Establish base access and verify core infrastructure on control-01.

Checklist:
- SSH access verified via Tailscale at 100.105.62.30
- Credentials secured in /root/.fredbot-secrets (contains API tokens for Cloudflare, Hetzner, Twenty CRM, and Tailscale)
- Cloudflare service token created with Zone:Read, DNS:Edit, Workers:Edit permissions
- Task queue verified working — test message sent and processed successfully within 2 seconds

Verification: SSH into control-01 via \`ssh root@100.105.62.30\`, confirm all credential files present with correct permissions (chmod 600), test Cloudflare API token with \`curl -H "Authorization: Bearer $CF_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify\`.`,
	status: 'done',
	priority: 'urgent',
	due_date: dateStr(-40),
	created_ago: 44,
	sort_order: 0
});

addTask('infra-p1a', {
	parentKey: 'infra-p1',
	title: 'Verify SSH access via Tailscale',
	status: 'done',
	priority: 'high',
	created_ago: 44,
	sort_order: 0
});
addTask('infra-p1b', {
	parentKey: 'infra-p1',
	title: 'Secure credentials in /root/.fredbot-secrets',
	status: 'done',
	priority: 'urgent',
	created_ago: 43,
	sort_order: 1
});
addTask('infra-p1c', {
	parentKey: 'infra-p1',
	title: 'Create Cloudflare service token',
	status: 'done',
	priority: 'high',
	created_ago: 42,
	sort_order: 2
});
addTask('infra-p1d', {
	parentKey: 'infra-p1',
	title: 'Verify task queue processing',
	status: 'done',
	priority: 'normal',
	created_ago: 41,
	sort_order: 3
});

addTask('infra-p2', {
	projectIdx: 0,
	title: 'Phase 2: Cloudflare Configuration',
	body: `Configure Cloudflare for the Fredbot Hosting platform. Three main deliverables:

1. Portal Access Application — Cloudflare Access app protecting app.fredbot.hosting. Policy: allow @fredbot.hosting emails + service token auth. Session duration: 24 hours. Bypass paths: /api/health, /api/webhook.

2. Customer Portal Worker — Cloudflare Worker handling customer self-service. Routes: GET /status (customer dashboard), POST /support (submit ticket), GET /docs (documentation proxy). Worker deployed to fredbot-customer-portal.workers.dev with custom domain mapping.

3. DNS Configuration — A record for app.fredbot.hosting → Cloudflare proxy, CNAME for www → pages deployment, TXT records for SPF/DKIM email authentication.`,
	status: 'done',
	priority: 'high',
	due_date: dateStr(-35),
	created_ago: 40,
	sort_order: 1
});

addTask('infra-p3', {
	projectIdx: 0,
	title: 'Phase 3: Twenty CRM Schema',
	body: `Define and deploy custom objects in Twenty CRM for customer and support tracking.

Customer Object Fields:
- email (TEXT, required, unique) — primary identifier
- companyName (TEXT, optional) — business name if applicable
- customerStatus (ENUM: trial, active, suspended, churned) — lifecycle stage
- agentSlug (TEXT, required) — unique slug for their hosted agent
- serverIp (TEXT) — assigned Hetzner server IP
- tailscaleHostname (TEXT) — hostname on Tailscale mesh
- onboardedAt (TIMESTAMP) — when provisioning completed

Support Task Object Fields:
- title (TEXT, required) — short description
- description (TEXT) — full details, may include markdown
- priority (ENUM: low, normal, high, urgent) — SLA tier mapping
- taskStatus (ENUM: open, claimed, in_progress, completed, failed) — lifecycle
- claimedAt (TIMESTAMP) — when an agent picked up the task
- lastHeartbeat (TIMESTAMP) — last agent check-in
- completedAt (TIMESTAMP) — resolution time
- result (TEXT) — outcome summary
- errorLog (TEXT) — failure details if applicable

Webhooks: #28 (customer.created → provision flow), #29 (support.created → agent queue).
API access verified with test CRUD operations (#31).`,
	status: 'done',
	priority: 'high',
	due_date: dateStr(-30),
	created_ago: 38,
	sort_order: 2
});

addTask('infra-p4', {
	projectIdx: 0,
	title: 'Phase 4: Tailscale Configuration',
	body: `Set up Tailscale mesh networking for secure inter-server communication.

Mesh Nodes:
- control-01: 100.105.62.30 (Hetzner VPS, primary server)
- elitebook: 100.67.63.119 (dev laptop for admin access)

ACL Policy: control-01 can reach all customer servers on ports 22 (SSH), 443 (HTTPS), 18789 (OpenClaw gateway). Elitebook has full access to control-01 only. Customer servers cannot reach each other (network isolation).

Auth Key: stored at /run/secrets/tailscale-authkey, tagged with tag:agent for automatic ACL application. Key is ephemeral (auto-expire after 90 days, auto-renew via cron).`,
	status: 'done',
	priority: 'normal',
	due_date: dateStr(-28),
	created_ago: 36,
	sort_order: 3
});

addTask('infra-p5', {
	projectIdx: 0,
	title: 'Phase 5: Hetzner Configuration',
	body: `Set up Hetzner Cloud CLI and project structure for customer server provisioning.

hcloud CLI installed on control-01 (v1.42.0). Two contexts configured:
- fredbot-infra: admin project for control plane resources (control-01, load balancer, volumes)
- fredbot-customers: isolated project for customer VPS instances

SSH Key: fredbot-provisioner (Ed25519, 4096-bit) registered in both projects. Used for automated server provisioning — the provisioning script creates a new server, injects this key, runs the bootstrap playbook, and registers the server in Twenty CRM.

Server Specs (per customer): CX21 (2 vCPU, 4GB RAM, 40GB SSD) at €4.85/mo. Upgrade path to CX31 (2 vCPU, 8GB RAM, 80GB SSD) at €8.85/mo for high-usage customers.`,
	status: 'done',
	priority: 'normal',
	due_date: dateStr(-25),
	created_ago: 34,
	sort_order: 4
});

addTask('infra-p6', {
	projectIdx: 0,
	title: 'Phase 6: Support Queue Processor',
	body: `Deploy the support queue processor that monitors Twenty CRM for new support tasks and dispatches them to available agents.

Scripts deployed to /opt/fredbot/:
- queue-processor.sh — polls Twenty CRM every 30 seconds for open support tasks, claims tasks by setting taskStatus to "claimed" and claimedAt timestamp, dispatches to agent via OpenClaw gateway
- health-check.sh — monitors agent heartbeats, marks tasks as failed if no heartbeat for 5 minutes
- cleanup.sh — archives completed tasks older than 30 days

Cron Jobs:
- */1 * * * * /opt/fredbot/queue-processor.sh (every minute)
- */5 * * * * /opt/fredbot/health-check.sh (every 5 minutes)
- 0 3 * * * /opt/fredbot/cleanup.sh (daily at 3 AM)

Test: created support task "Test ticket — verify queue processor" via API, confirmed it was claimed within 60 seconds and processed successfully.`,
	status: 'done',
	priority: 'high',
	due_date: dateStr(-20),
	created_ago: 32,
	sort_order: 5
});

// =========================================================================
// P1: Production Readiness (4 phase tasks)
// =========================================================================

addTask('prod-p71', {
	projectIdx: 1,
	title: 'Phase 7.1: Monitoring & Alerting',
	body: `Set up comprehensive monitoring using Netdata on control-01.

Alert Thresholds:
- CPU: warning at 80% sustained (5 min), critical at 95% sustained (2 min)
- Memory: warning at 85%, critical at 95%
- Disk: warning at 80%, critical at 90%
- Network: warning at 80% bandwidth utilization

Log Aggregation: all service logs written to /var/log/fredbot/ with logrotate configured (7 days retention, compressed). Includes: queue-processor.log, health-check.log, provisioning.log, nginx-access.log.

OPEN ITEM: Email/Slack notifications deferred — requires SMTP configuration (considering Resend API for transactional emails) or Slack webhook setup. Currently alerts are only visible in Netdata dashboard at http://control-01:19999.`,
	status: 'done',
	priority: 'high',
	due_date: dateStr(-10),
	created_ago: 28,
	sort_order: 0
});

addTask('prod-p72', {
	projectIdx: 1,
	title: 'Phase 7.2: Backup & Recovery',
	body: `PostgreSQL backup strategy with daily snapshots and tested restore procedure.

Backup Script: /opt/fredbot/backup-postgres.sh
- Runs daily at 2 AM via cron
- Uses pg_dump with --format=custom for efficient storage
- Compressed output: ~117K for current dataset
- Retention: 7 daily backups (older automatically deleted)
- Backup location: /var/backups/fredbot/postgres/

Restore Procedure (documented in /opt/fredbot/RESTORE.md):
1. Stop services: systemctl stop fredbot-queue fredbot-health
2. Drop and recreate database: dropdb fredbot && createdb fredbot
3. Restore: pg_restore -d fredbot /var/backups/fredbot/postgres/latest.dump
4. Verify: psql fredbot -c "SELECT count(*) FROM customers"
5. Restart services: systemctl start fredbot-queue fredbot-health

Test: full backup/restore cycle completed successfully on Feb 10. Restore time: ~3 seconds for current dataset size.`,
	status: 'done',
	priority: 'high',
	due_date: dateStr(-8),
	created_ago: 25,
	sort_order: 1
});

addTask('prod-p73', {
	projectIdx: 1,
	title: 'Phase 7.3: Documentation & Runbooks',
	body: `Create operational documentation for managing the Fredbot Hosting infrastructure.

/opt/fredbot/OPERATIONS.md — comprehensive runbook covering:
- Server access procedures (Tailscale, SSH keys, sudo)
- Daily checklist: check Netdata dashboard, verify queue processing, review error logs
- Weekly checklist: review backup integrity, check disk usage trends, update dependencies
- Troubleshooting guides: queue processor stuck, high memory usage, disk full, Tailscale disconnected
- Emergency procedures: server unresponsive, database corruption, security incident response

/opt/fredbot/RESTORE.md — database recovery procedures (see Phase 7.2)

TODO: add architecture diagram and network topology to OPERATIONS.md.`,
	status: 'done',
	priority: 'normal',
	due_date: dateStr(-5),
	created_ago: 22,
	sort_order: 2
});

addTask('prod-p75', {
	projectIdx: 1,
	title: 'Phase 7.5: Security Hardening',
	body: `Harden control-01 against common attack vectors.

fail2ban:
- Installed and active, protecting SSH (port 22)
- 678 total bans since installation
- Ban time: 1 hour (repeat offenders: 24 hours)
- Max retries: 3 within 10 minutes

UFW Firewall:
- Default: deny incoming, allow outgoing
- Allowed ports: 22 (SSH — rate limited), 19999 (Netdata — Tailscale IPs only)
- All other ports blocked including 80/443 (services proxied through Cloudflare)

SSH Hardening (/etc/ssh/sshd_config):
- PermitRootLogin: prohibit-password (key-only)
- PasswordAuthentication: no
- MaxAuthTries: 3
- MaxSessions: 5
- AllowUsers: root (only user needed on this server)
- Protocol: 2

File Permissions:
- /root/.fredbot-secrets: 600 (owner read/write only)
- /opt/fredbot/*.sh: 700 (owner execute only)
- /var/backups/fredbot: 700 (owner only)
- Cron files: 644 with root ownership`,
	status: 'in_progress',
	priority: 'high',
	due_date: dateStr(2),
	created_ago: 20,
	sort_order: 3
});

addTask('prod-p75a', {
	parentKey: 'prod-p75',
	title: 'Configure SMTP for alert notifications',
	body: 'Set up Resend API for transactional email delivery. Create fredbot-alerts@fredbot.hosting sender. Configure Netdata to send email alerts on warning/critical thresholds.',
	status: 'todo',
	priority: 'high',
	due_date: dateStr(3),
	created_ago: 15,
	sort_order: 0
});
addTask('prod-p75b', {
	parentKey: 'prod-p75',
	title: 'Set up Slack webhook for alerts',
	body: 'Create #infra-alerts channel in Fredbot Hosting Slack workspace. Configure Netdata Slack integration with webhook URL. Test with manual alert trigger.',
	status: 'todo',
	priority: 'normal',
	created_ago: 15,
	sort_order: 1
});
addTask('prod-p75c', {
	parentKey: 'prod-p75',
	title: 'Audit and rotate all API keys',
	body: 'Review all API keys in /root/.fredbot-secrets for expiration dates. Rotate Cloudflare, Hetzner, and Tailscale tokens. Update Twenty CRM API key. Document rotation schedule (quarterly).',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(5),
	created_ago: 12,
	sort_order: 2
});

// =========================================================================
// P2: Competitive Intelligence (tasks with competitor data)
// =========================================================================

addTask('intel-scan', {
	projectIdx: 2,
	title: 'Set up daily competitor scan cron job',
	body: `Automated daily scan script that checks competitor domains for changes.

For each competitor domain:
1. WHOIS lookup — check registration changes, expiration, registrar
2. HTTP probe — check if site is up, response time, redirect chain
3. Content hash — detect homepage changes (SHA256 of rendered HTML)
4. Social scan — check Twitter/X, LinkedIn, GitHub for new posts mentioning brand
5. Pricing check — scrape pricing pages for changes

Results written to /opt/fredbot/intel/daily-report-YYYY-MM-DD.json
Summary email sent to fred@fdsconsulting.com

Current targets:
- clawdhost.net (Active, $25/mo)
- clawdhost.xyz (Active, $10-20/mo, Telegram-focused)
- clawdbot.host (Parked)
- openclaw.host (Active, multilingual)
- openclawd.ai (Monitor)
- xcloud.host/openclaw-hosting (NEW, $24/mo)`,
	status: 'done',
	priority: 'high',
	created_ago: 18,
	sort_order: 0
});

addTask('intel-moltworker', {
	projectIdx: 2,
	title: 'Deep analysis: Cloudflare moltworker threat',
	body: `The moltworker project on Cloudflare Workers represents the most significant competitive threat. It offers free AI agent hosting by leveraging Cloudflare's free Workers tier, completely eliminating hosting costs.

Analysis needed:
- What are the technical limitations of Workers-based hosting? (CPU time limits, memory constraints, cold starts, no persistent storage, no WebSocket support on free tier)
- What features does moltworker lack that we can differentiate on? (managed updates, support, monitoring, custom domains, persistent storage, database access)
- How many users/stars does the project have? Growth trajectory?
- Is Cloudflare likely to shut down or rate-limit this use case?

Our competitive response should focus on: managed services value prop, SLA guarantees, support quality, and features that can't run on serverless (long-running agents, persistent memory, large context windows, multi-agent orchestration).`,
	status: 'in_progress',
	priority: 'urgent',
	due_date: dateStr(3),
	created_ago: 10,
	sort_order: 1
});

addTask('intel-weekly', {
	projectIdx: 2,
	title: 'Compile weekly intelligence brief',
	body: 'Aggregate daily scan results into a formatted weekly report. Include: new competitors detected, pricing changes, feature announcements, social media sentiment, risk assessment updates. Distribute to stakeholders.',
	status: 'in_progress',
	priority: 'normal',
	due_date: dateStr(0),
	created_ago: 14,
	sort_order: 2
});

// =========================================================================
// P3: Unified Channel Dashboard
// =========================================================================

addTask('ucd-polish', {
	projectIdx: 3,
	title: 'Polish & QA',
	body: `Final polish pass before declaring the unified channel dashboard feature-complete.

Areas to address:
- Message rendering edge cases: very long messages, messages with only images, empty messages, messages with 50+ code blocks
- Mobile responsiveness: test on iPhone SE (smallest), iPad, and various Android devices
- Keyboard navigation: tab order, escape to close, enter to send, ctrl+k for search
- Screen reader compatibility: ARIA labels on all interactive elements, live regions for new messages
- Performance: profile with React DevTools, ensure virtual scroll handles 10K+ messages without jank
- Dark/light mode: verify all components respect theme, no hard-coded colors
- Error states: network disconnection, server errors, rate limiting, session expiry`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(14),
	created_ago: 8,
	sort_order: 0
});

addTask('ucd-search', {
	projectIdx: 3,
	title: 'Search & Navigation',
	body: `Implement cross-session search and navigation features.

Search:
- Full-text search across all sessions (messages, file names, code blocks)
- Filters: by session, date range, author (user vs agent), message type (text, code, file)
- Result preview with highlighted matches and surrounding context
- Click result to jump to message in session view

Navigation:
- Session switcher with recent sessions list (cmd+k style)
- Jump to date within a session
- Pin important messages for quick access
- Session bookmarks with labels`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(21),
	created_ago: 8,
	sort_order: 1
});

// =========================================================================
// P4: LLC Formation
// =========================================================================

addTask('llc-articles', {
	projectIdx: 4,
	title: 'File articles of organization',
	body: 'File with Delaware Division of Corporations. Filing fee: $90. Need: company name (Fredbot Hosting, LLC), registered agent (use Northwest Registered Agent — $125/year), organizer info, effective date.',
	status: 'todo',
	priority: 'high',
	due_date: dateStr(7),
	created_ago: 24,
	sort_order: 0
});

addTask('llc-ein', {
	projectIdx: 4,
	title: 'Obtain EIN from IRS',
	body: 'Apply for Employer Identification Number via IRS.gov. Free, instant online. Need: SSN of responsible party, LLC formation date, business address. Required before opening business bank account.',
	status: 'todo',
	priority: 'high',
	due_date: dateStr(10),
	created_ago: 24,
	sort_order: 1
});

addTask('llc-foreign', {
	projectIdx: 4,
	title: 'Foreign qualification in Illinois',
	body: 'Register the Delaware LLC to do business in Illinois. File with IL Secretary of State. Fee: $150 + $100 annual report. Need: certificate of good standing from Delaware, registered agent in IL.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(14),
	created_ago: 24,
	sort_order: 2
});

addTask('llc-bank', {
	projectIdx: 4,
	title: 'Open business bank account',
	body: 'Open business checking at Mercury (online-first, good for startups) or Chase Business Complete. Need: EIN, articles of organization, operating agreement. Mercury requires no minimum balance.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(14),
	created_ago: 24,
	sort_order: 3
});

// =========================================================================
// P5: Website / Landing Page
// =========================================================================

addTask('site-design', {
	projectIdx: 5,
	title: 'Design landing page in Figma',
	body: 'Create high-fidelity mockups for mobile and desktop. Sections: hero with product screenshot, feature grid (6 features), pricing table (Starter $10/mo, Pro $25/mo, Enterprise custom), testimonials carousel, FAQ accordion, footer with links.',
	status: 'todo',
	priority: 'high',
	due_date: dateStr(20),
	created_ago: 18,
	sort_order: 0
});

addTask('site-build', {
	projectIdx: 5,
	title: 'Build site with Astro + Tailwind',
	body: 'Static site using Astro framework for optimal performance. Tailwind CSS for styling. Deploy to Cloudflare Pages. Target: Lighthouse score 95+ on all metrics. Include: Open Graph meta tags, Twitter cards, JSON-LD structured data.',
	status: 'todo',
	priority: 'high',
	due_date: dateStr(35),
	created_ago: 18,
	sort_order: 1
});

addTask('site-copy', {
	projectIdx: 5,
	title: 'Write marketing copy',
	body: 'Hero headline, feature descriptions, pricing tier details, FAQ answers, meta descriptions. Tone: professional but approachable, technical but not jargon-heavy. Target audience: developers and small teams who want managed AI agent hosting without DevOps overhead.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(18),
	created_ago: 15,
	sort_order: 2
});

// =========================================================================
// P11: Tax Resolution
// =========================================================================

addTask('tax-gather', {
	projectIdx: 11,
	title: 'Gather 2025 tax documents for Scott',
	body: `Collect all required documents for current-year tax filing:

Income:
- W-2 from FDS Consulting (employer)
- 1099-NEC from any freelance/contract work
- 1099-INT from bank interest (Chase, Marcus)
- 1099-DIV from investment dividends (Fidelity, Wealthsimple)
- 1099-B from stock/crypto sales

Deductions:
- 1098 mortgage interest statement
- Property tax bills (Cook County)
- Charitable donation receipts ($250+ require written acknowledgment)
- Medical expenses exceeding 7.5% AGI threshold
- Home office deduction records (if applicable)
- Business expenses for FDS Consulting

Status: Still waiting on 1099-DIV from Wealthsimple (usually arrives mid-February).`,
	status: 'in_progress',
	priority: 'urgent',
	due_date: dateStr(-7),
	created_ago: 35,
	sort_order: 0
});

addTask('tax-michael', {
	projectIdx: 11,
	title: 'Provide financial info to Michael for back tax settlement',
	body: `Michael C. Whelan JD CPA needs updated financial information for the settlement offer:

Required documents:
- Last 3 years of tax returns (2022, 2023, 2024)
- Current year income projection for 2025
- Bank statements (last 6 months, all accounts)
- Investment account statements
- Real estate valuation (condo assessment + recent comps)
- Vehicle value (KBB estimate)
- Monthly expense breakdown

Contact: michael@whelantax.com, 312-555-0293
Office: 123 N Wacker Dr, Suite 1500, Chicago, IL 60606

Next step: email all documents to Michael, then schedule 30-min call to discuss settlement strategy. He mentioned IRS is more willing to negotiate OIC (Offer in Compromise) when you demonstrate inability to pay full amount.`,
	status: 'in_progress',
	priority: 'high',
	due_date: dateStr(-5),
	created_ago: 30,
	sort_order: 1
});

addTask('tax-followup', {
	projectIdx: 11,
	title: 'Follow up on settlement timeline',
	body: 'Call Michael every 2 weeks for status update. IRS OIC process typically takes 6-12 months. Keep records of all correspondence. If no response from IRS within 60 days of submission, contact Taxpayer Advocate at 877-777-4778.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(14),
	created_ago: 20,
	sort_order: 2
});

// =========================================================================
// P12: Gym Signup
// =========================================================================

addTask('gym-tour', {
	projectIdx: 12,
	title: 'Visit facility for tour',
	body: `Get a free guest pass and tour West Loop Athletic Club.

Things to check:
- Pool: lap swim hours, lane availability, temperature
- Sauna/steam room: hours, capacity, temperature, maintenance schedule
- Weight room: squat racks (how many?), free weight selection, platform availability
- Locker rooms: cleanliness, locker size, towel service quality
- Parking: where to park, is it free?
- Peak hours: when is it most/least crowded?

Free guest pass available online at chicagoathleticclubs.com or call (312) 850-4667 to book a tour.`,
	status: 'todo',
	priority: 'high',
	due_date: dateStr(-1),
	created_ago: 16,
	sort_order: 0
});

addTask('gym-signup', {
	projectIdx: 12,
	title: 'Sign up for membership',
	body: 'Choose plan: All-Access ($84/mo, 7 locations) vs Single ($74-79/mo). Check for current promotions — the $0 enrollment promo expired 2/16 but they often run new ones. Bring: ID, credit card, emergency contact info.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(3),
	created_ago: 16,
	sort_order: 1
});

addTask('gym-routine', {
	projectIdx: 12,
	title: 'Establish workout routine',
	body: `Plan weekly schedule integrating pool, sauna, and weight training:

Mon/Wed/Fri: Strength training (push/pull/legs split)
Tue/Thu: Swim (30 min lap swim) + sauna (15 min)
Sat: Group fitness class (try yoga or rowing)
Sun: Active recovery — sauna + steam room

Contrast therapy protocol:
- Cold plunge at home (3 min at 50°F)
- Sauna at gym (15-20 min at 170-185°F)
- Alternate 2-3 rounds on sauna days

Goal: 5 sessions/week minimum for first month to build habit.`,
	status: 'todo',
	priority: 'low',
	due_date: dateStr(14),
	created_ago: 16,
	sort_order: 2
});

// =========================================================================
// P13: Medical Referrals
// =========================================================================

addTask('med-pt-research', {
	projectIdx: 13,
	title: 'Research closest PT location',
	body: `Find the Northwestern Medicine Physical Therapy location closest to Ukrainian Village (home: 2432 W Chicago Ave, 60622).

Possible locations:
- NM PT at 259 E Erie St (downtown, ~4 miles, 20 min drive)
- NM PT at 2650 N Lakeview Ave (Lincoln Park, ~3 miles, 15 min drive)
- NM PT at 1000 W Montrose Ave (Uptown, ~5 miles)

Call (630) 933-1500 to confirm which locations accept new patients with existing referral from Joy Li, PA-C. Ask about: availability (evening/weekend appointments?), wait time for first appointment, what to bring (referral order, insurance card, imaging if any).`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(5),
	created_ago: 12,
	sort_order: 0
});

addTask('med-allergy', {
	projectIdx: 13,
	title: 'Schedule Allergy & Immunology appointment',
	body: `Call 312-695-8624 to schedule initial allergy consultation at Northwestern Medicine downtown.

Referral info:
- Referring provider: Joy Li, PA-C
- Order date: November 7, 2025
- Reason: seasonal allergies not responding to OTC Claritin/Zyrtec, possible environmental allergens, immunotherapy evaluation

Questions for scheduling:
- Is the Nov 7 referral still valid or does a new one need to be submitted?
- First available appointment?
- Do they do skin prick testing on the first visit or is that a separate appointment?
- Any prep needed (stop antihistamines X days before)?

Insurance: Blue Cross PPO, no prior auth needed.`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(7),
	created_ago: 12,
	sort_order: 1
});

addTask('med-pt-schedule', {
	projectIdx: 13,
	title: 'Schedule Physical Therapy appointment',
	body: 'Call chosen PT location to schedule first appointment. Referral from Joy Li, PA-C dated Oct 21, 2025. Chronic lower back pain with sciatica symptoms. Insurance covers 80% after deductible, 30 visits/year.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(10),
	created_ago: 12,
	sort_order: 2
});

// =========================================================================
// P14: Road Trip
// =========================================================================

addTask('trip-vegas-dog', {
	projectIdx: 14,
	title: 'Book Vegas dog boarding (March 18-21)',
	body: `Find dog boarding for Penny in Las Vegas area, March 18-21 (3 nights).

Requirements:
- Individual kennel (Penny doesn't do well in group play)
- Outdoor time at least 2x daily
- Can administer medication (daily joint supplement)
- Reviews 4.5+ stars
- Under $60/night preferred

Options to research:
- Camp Bow Wow Las Vegas (Henderson location)
- The Dog Resort Las Vegas
- Rover.com for private sitters (sometimes calmer than facility boarding)

Book ASAP — March is spring break season, places fill up fast.`,
	status: 'todo',
	priority: 'high',
	due_date: dateStr(14),
	created_ago: 25,
	sort_order: 0
});

addTask('trip-ps-dog', {
	projectIdx: 14,
	title: 'Book Palm Springs dog boarding (March 26-29)',
	body: 'Find dog boarding for Penny in Palm Springs area, March 26-29 (3 nights). Same requirements as Vegas booking. Check if the AirBnB is pet-friendly — if so, Penny can stay with us and skip boarding.',
	status: 'todo',
	priority: 'high',
	due_date: dateStr(14),
	created_ago: 25,
	sort_order: 1
});

addTask('trip-overnight', {
	projectIdx: 14,
	title: 'Book overnight stops for driving legs',
	body: `Need pet-friendly hotel stops for the long drives:

Leg 1: Chicago → Vegas (~1,750 mi)
- Night 1: Kansas City, MO area (8 hours from Chicago)
- Night 2: Albuquerque or Flagstaff (8-9 hours from KC)

Leg 5: Palm Springs → Chicago (~1,900 mi)
- Night 1: Amarillo, TX (10 hours from PS)
- Night 2: Oklahoma City or Springfield, MO (6-8 hours from Amarillo)

Requirements: pet-friendly (no breed restrictions for 65lb pit mix), under $120/night, highway adjacent. La Quinta and Motel 6 are reliably pet-friendly. Use BringFido.com to search.`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(20),
	created_ago: 22,
	sort_order: 2
});

addTask('trip-ps-airbnb', {
	projectIdx: 14,
	title: 'Get Palm Springs AirBnB details from Shari',
	body: 'Shari booked the Palm Springs AirBnB. Need: confirmation number, address, check-in/check-out times, pet policy, amenities, WiFi password. Also confirm dates (March 26-29) and total cost/split.',
	status: 'in_progress',
	priority: 'normal',
	created_ago: 15,
	sort_order: 3
});

addTask('trip-tahoe', {
	projectIdx: 14,
	title: 'Book Tahoe lodging (March 21-24)',
	body: `Book hotel in South Lake Tahoe for skiing at Heavenly, March 21-24 (3 nights). Sharing with Brian Plotkin.

Top options:
- Hotel A: ★5.0 rating, 1BR with 2 beds, ski-in/ski-out adjacent, ~$189/night
- Hotel B: ★4.71 rating, 1BR with 2 beds, 5 min shuttle to Heavenly, ~$159/night

Preference: Hotel A if under $200/night total. Split cost with Brian 50/50. Check if lift tickets can be bundled with hotel for discount.`,
	status: 'todo',
	priority: 'high',
	due_date: dateStr(10),
	created_ago: 20,
	sort_order: 4
});

// =========================================================================
// P15: Bachelor Party
// =========================================================================

addTask('bach-deposit', {
	projectIdx: 15,
	title: 'Pay $500 deposit to Jeff Nelson',
	body: 'Venmo or Zelle $500 to Jeff Nelson (jeffnelson16@gmail.com) for bachelor party deposit. Covers shared accommodation and group activities at Big Sky. Due by end of February 2026.',
	status: 'todo',
	priority: 'urgent',
	due_date: dateStr(9),
	created_ago: 18,
	sort_order: 0
});

addTask('bach-flight', {
	projectIdx: 15,
	title: 'Book flight ORD → Bozeman (July 16-19)',
	body: `Book round-trip flight from Chicago O'Hare (ORD) to Bozeman Yellowstone International (BZN).

Dates: depart July 16 (morning preferred), return July 19 (evening)
Budget: $350-500 round trip
Airlines: United has direct flights (~3.5 hours), Delta/American connect through Denver or Minneapolis

Set price alert on Google Flights. Best booking window for July travel is typically 6-8 weeks out (late May / early June). Coordinate arrival time with bachelor party group so we can share transportation from airport.`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(90),
	created_ago: 18,
	sort_order: 1
});

addTask('bach-coordinate', {
	projectIdx: 15,
	title: 'Coordinate arrival time with group',
	body: 'Once flight is booked, share itinerary in group chat. Figure out airport transportation — rent a car or arrange shuttle to Big Sky (~45 min drive from Bozeman). Check if Jeff is coordinating group transport.',
	status: 'todo',
	priority: 'low',
	due_date: dateStr(95),
	created_ago: 15,
	sort_order: 2
});

// =========================================================================
// P16: Google Contacts Sync
// =========================================================================

addTask('contacts-audit', {
	projectIdx: 16,
	title: 'Export and diff contacts from both accounts',
	body: `Export contacts from both Google accounts and identify duplicates, orphans, and conflicts.

Accounts:
- Personal: fdsouvenir@gmail.com
- Work: fred@fdsconsulting.com

Steps:
1. Use Google People API to export all contacts with all fields
2. Normalize phone numbers (strip formatting, add country code)
3. Match on: exact email, normalized phone, or fuzzy name match (Levenshtein distance < 3)
4. Generate diff report: contacts only in personal, only in work, in both (with field-level diffs)
5. Flag: contacts with conflicting info (different phone for same person)

Expected results: ~400 contacts personal, ~250 work, ~150 overlap.`,
	status: 'todo',
	priority: 'low',
	due_date: null,
	created_ago: 24,
	sort_order: 0
});

addTask('contacts-cleanup', {
	projectIdx: 16,
	title: 'Review diff and clean up contacts',
	body: 'Review the diff report. Delete contacts with no recent interaction (3+ years), merge duplicates keeping the most complete record, standardize name formatting (First Last, not LAST First). Estimate: 2-3 hours of manual review.',
	status: 'todo',
	priority: 'low',
	due_date: null,
	created_ago: 24,
	sort_order: 1
});

// =========================================================================
// P17: Multi-Agent Orchestration
// =========================================================================

addTask('mao-skill', {
	projectIdx: 17,
	title: 'Phase 1: Create skill structure',
	body: `Set up the oh-my-clawdbot skill within Clawdbot's existing skill system.

Files to create:
- skills/oh-my-clawdbot/manifest.json (skill metadata, capabilities declaration)
- skills/oh-my-clawdbot/index.ts (entry point, skill lifecycle hooks)
- skills/oh-my-clawdbot/registry.ts (agent registry with capability declarations)
- skills/oh-my-clawdbot/router.ts (task → agent routing logic)
- skills/oh-my-clawdbot/orchestrator.ts (execution engine)

The skill should register itself with Clawdbot on startup and expose a single invoke method that accepts a task description and returns the orchestrated result.`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(30),
	created_ago: 14,
	sort_order: 0
});

addTask('mao-routing', {
	projectIdx: 17,
	title: 'Phase 3: Model routing logic',
	body: `Implement cost-aware model routing that selects the cheapest model capable of handling each subtask.

Routing matrix:
- Simple lookup/retrieval → Haiku (fastest, cheapest)
- Summarization, formatting → Haiku or Sonnet
- Code generation, analysis → Sonnet
- Complex reasoning, planning → Opus
- Multi-step with tool use → Opus

Cost tracking:
- Log input/output tokens per subtask
- Running cost total for the orchestration
- Budget ceiling per orchestration (configurable, default $1.00)
- Warn at 80% budget, halt at 100%`,
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(45),
	created_ago: 14,
	sort_order: 1
});

// =========================================================================
// P18: PM Dashboard Redesign
// =========================================================================

addTask('pm-projectlist', {
	projectIdx: 18,
	title: 'ProjectList overhaul',
	body: `Redesign the project list page with:
- Dashboard header: stat cards (Total, Active, Due Soon, Overdue) from getPMStats/getDashboardContext
- Attention chips for items needing action
- Filter pills: Active (default), All, Done, Archived
- Domain → Focus grouping with collapsible domain headers
- Status pills (translucent colored), priority tags (high/urgent only), smart due date formatting
- Orphan projects (no domain) render in flat "Other" section`,
	status: 'done',
	priority: 'high',
	due_date: dateStr(-5),
	created_ago: 14,
	sort_order: 0
});

addTask('pm-detail', {
	projectIdx: 18,
	title: 'ProjectDetail task table redesign',
	body: `Overhaul the task table in ProjectDetail modal:
- New column order: Task | Status (pill) | Priority (tag, high/urgent only) | Due (smart formatted)
- Remove border-l-2 status border (redundant with pill)
- Remove STATUS_DOT (replaced by pill)
- Priority column hidden on mobile
- Subtasks get same treatment
- Import getStatusPill, getPriorityTag, formatDueDate from pm-utils`,
	status: 'in_progress',
	priority: 'high',
	due_date: dateStr(1),
	created_ago: 10,
	sort_order: 1
});

addTask('pm-taskpanel', {
	projectIdx: 18,
	title: 'TaskDetailPanel improvements',
	body: 'Add priority badges, ancestry breadcrumb, subtask list with inline status/priority. Ensure long body text renders well with scrolling. Test with tasks that have 500+ character descriptions.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(5),
	created_ago: 8,
	sort_order: 2
});

// =========================================================================
// P19: Gateway Canvas Bridge
// =========================================================================

addTask('canvas-register', {
	projectIdx: 19,
	title: 'Implement canvas.bridge.register method',
	body: `Register calling operator as a virtual canvas node.

Implementation:
- Accept operator connection metadata (client ID, capabilities)
- Create synthetic client object with role: "node" for nodeRegistry compatibility
- Register via nodeRegistry.register() with generated node ID
- Return node ID and registration confirmation to caller
- Handle duplicate registration (same operator re-registering after reconnect)

Security: validate that the calling client has operator role and canvas capabilities declared in their connect frame.`,
	status: 'done',
	priority: 'high',
	created_ago: 20,
	sort_order: 0
});

addTask('canvas-invoke', {
	projectIdx: 19,
	title: 'Implement canvas.bridge.invokeResult method',
	body: `Proxy invoke results from operators back through the node registry pipeline.

The tricky part: NODE_ROLE_METHODS authorization needs to be bypassed because the result is coming from an operator (not a node). The invokeResult method needs to:
1. Validate the result format (requestId, result/error payload)
2. Look up the original invoke request to verify the operator is the registered handler
3. Call nodeRegistry.handleInvokeResult() directly, skipping role-based authorization
4. Clean up the pending invoke tracking state`,
	status: 'done',
	priority: 'high',
	created_ago: 18,
	sort_order: 1
});

addTask('canvas-unregister', {
	projectIdx: 19,
	title: 'Implement canvas.bridge.unregister method',
	body: 'Explicit cleanup when operator disconnects or no longer wants to act as canvas node. Call nodeRegistry.unregister() with the node ID. Handle gracefully if node was already unregistered (disconnect race condition).',
	status: 'done',
	priority: 'normal',
	created_ago: 16,
	sort_order: 2
});

addTask('canvas-tests', {
	projectIdx: 19,
	title: 'Write integration tests for bridge plugin',
	body: `Test scenarios:
1. Register → invoke → result → unregister (happy path)
2. Register duplicate operator (should replace previous registration)
3. Invoke with no registered handler (should return error)
4. Unregister non-existent node (should not throw)
5. Operator disconnect during pending invoke (should timeout gracefully)
6. Concurrent invokes to same node (should queue or round-robin)

Use the gateway test harness with mock WebSocket connections.`,
	status: 'review',
	priority: 'normal',
	due_date: dateStr(1),
	created_ago: 12,
	sort_order: 3
});

// =========================================================================
// P6: Branding
// =========================================================================

addTask('brand-research', {
	projectIdx: 6,
	title: 'Research competitor branding',
	body: 'Analyze visual identity of top AI hosting competitors. Collect: logos, color palettes, typography, tone of voice. Look at: Vercel, Railway, Render, Fly.io, Cloudflare for inspiration (clean, developer-focused aesthetic).',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(20),
	created_ago: 16,
	sort_order: 0
});

addTask('brand-logo', {
	projectIdx: 6,
	title: 'Design logo and brand guidelines',
	body: 'Create logo (wordmark + icon), select color palette (primary, secondary, accent, semantic), choose typography (heading + body fonts). Deliverables: SVG files (full color, monochrome, icon only), brand guidelines PDF with usage rules.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(28),
	created_ago: 16,
	sort_order: 1
});

// =========================================================================
// P10: Accounting Setup
// =========================================================================

addTask('acct-setup', {
	projectIdx: 10,
	title: 'Set up Wave accounting',
	body: 'Create Wave account for Fredbot Hosting, LLC. Configure: chart of accounts (revenue, COGS, operating expenses, payroll), invoice template with branding, expense categories (hosting, software, services, marketing). Wave is free for invoicing and accounting.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(20),
	created_ago: 11,
	sort_order: 0
});

addTask('acct-connect', {
	projectIdx: 10,
	title: 'Connect business bank account',
	body: 'Link Mercury/Chase business checking to Wave for automatic transaction import. Set up rules to auto-categorize recurring expenses (Hetzner, Cloudflare, Tailscale, domain registrations).',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(28),
	created_ago: 11,
	sort_order: 1
});

// =========================================================================
// P20: Lead Capture
// =========================================================================

addTask('lead-form', {
	projectIdx: 20,
	title: 'Build signup/waitlist form',
	body: 'Embed form on landing page. Fields: email (required), company name (optional), use case (dropdown: personal, startup, enterprise). Store in Twenty CRM customer object with status: "lead". Send confirmation email via Resend.',
	status: 'todo',
	priority: 'normal',
	due_date: dateStr(45),
	created_ago: 9,
	sort_order: 0
});

addTask('lead-email', {
	projectIdx: 20,
	title: 'Set up welcome email sequence',
	body: `Automated email drip campaign for new leads:

Email 1 (immediate): Welcome + what to expect
Email 2 (day 3): Feature highlights + use cases
Email 3 (day 7): Getting started guide + docs link
Email 4 (day 14): "Ready to start?" + pricing + CTA

Use Resend for delivery, store templates in repo. Track open rates and click-through.`,
	status: 'todo',
	priority: 'low',
	due_date: dateStr(55),
	created_ago: 9,
	sort_order: 1
});

console.log(`  Tasks: ${taskCount}`);

// ---------------------------------------------------------------------------
// Blocks (task dependencies)
// ---------------------------------------------------------------------------

const insertBlock = db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)');

const blockPairs = [
	['llc-articles', 'llc-ein'], // Articles before EIN
	['llc-ein', 'llc-bank'], // EIN before bank account
	['llc-foreign', 'llc-bank'], // IL registration before bank
	['infra-p1', 'infra-p2'], // Phase 1 before Phase 2
	['infra-p2', 'infra-p3'], // Phase 2 before Phase 3
	['infra-p3', 'infra-p4'], // Phase 3 before Phase 4
	['infra-p5', 'infra-p6'], // Hetzner before support queue
	['prod-p71', 'prod-p75a'], // Monitoring before SMTP alerts
	['med-pt-research', 'med-pt-schedule'], // Research PT location before scheduling
	['contacts-audit', 'contacts-cleanup'], // Audit before cleanup
	['brand-logo', 'site-design'], // Logo before landing page design
	['site-design', 'site-build'], // Design before build
	['site-copy', 'site-build'], // Copy before build
	['gym-tour', 'gym-signup'], // Tour before signup
	['gym-signup', 'gym-routine'], // Signup before routine
	['canvas-register', 'canvas-invoke'], // Register before invoke
	['canvas-invoke', 'canvas-unregister'] // Invoke before unregister (testing order)
];

for (const [blockerKey, blockedKey] of blockPairs) {
	insertBlock.run(taskIds[blockerKey], taskIds[blockedKey]);
}
console.log(`  Blocks: ${blockPairs.length}`);

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

const insertComment = db.prepare(`
	INSERT INTO comments (target_type, target_id, body, author, created_at)
	VALUES (?, ?, ?, ?, ?)
`);

const comments = [
	{
		target_type: 'project',
		target_id: projectIds[0],
		body: 'All 6 phases complete. Infrastructure is live and serving test customers. Moving to production readiness next.',
		author: 'fred',
		created_ago: 4
	},
	{
		target_type: 'project',
		target_id: projectIds[0],
		body: 'Wave 2 verification tests all passed. Queue processor handling 50+ tasks/day without issues. Memory usage stable at ~180MB.',
		author: 'verlbot',
		created_ago: 3
	},
	{
		target_type: 'project',
		target_id: projectIds[1],
		body: 'Phases 7.1-7.3 complete. Security hardening (7.5) in progress — fail2ban and UFW done, SSH hardened. Still need to set up SMTP for alert notifications.',
		author: 'fred',
		created_ago: 5
	},
	{
		target_type: 'task',
		target_id: taskIds['prod-p75'],
		body: 'fail2ban has blocked 678 attempts in the first 2 weeks. Most are SSH brute force from Chinese and Russian IPs. The rate limiting is working well.',
		author: 'verlbot',
		created_ago: 8
	},
	{
		target_type: 'project',
		target_id: projectIds[2],
		body: 'The moltworker project on Cloudflare is growing fast — 200+ stars on GitHub in 2 weeks. Need to accelerate our launch timeline.',
		author: 'fred',
		created_ago: 5
	},
	{
		target_type: 'task',
		target_id: taskIds['intel-moltworker'],
		body: "Analysis shows moltworker has significant limitations: 10ms CPU time limit per request (can't run long inference), no WebSocket support on free tier, no persistent storage. Our managed approach with dedicated VPS, persistent memory, and WebSocket support is still differentiated.",
		author: 'verlbot',
		created_ago: 3
	},
	{
		target_type: 'project',
		target_id: projectIds[11],
		body: 'Got all W-2s and most 1099s. Still waiting on Wealthsimple 1099-DIV. Michael needs the financial docs ASAP for the OIC submission.',
		author: 'fred',
		created_ago: 6
	},
	{
		target_type: 'task',
		target_id: taskIds['tax-michael'],
		body: 'Emailed bank statements and tax returns to Michael. Scheduling call for next Tuesday to discuss settlement strategy. He says IRS is backlogged so timing is actually favorable.',
		author: 'fred',
		created_ago: 4
	},
	{
		target_type: 'project',
		target_id: projectIds[14],
		body: 'Vegas is booked! Staying at The Linq, good location on the Strip. Now need to sort out dog boarding and overnight stops.',
		author: 'fred',
		created_ago: 12
	},
	{
		target_type: 'task',
		target_id: taskIds['trip-ps-airbnb'],
		body: 'Texted Shari — she said the AirBnB is in Palm Desert (not Palm Springs proper), has a pool, and is pet-friendly! Penny can come. Will send confirmation details by this weekend.',
		author: 'fred',
		created_ago: 2
	},
	{
		target_type: 'project',
		target_id: projectIds[18],
		body: 'ProjectList redesign is deployed and looking great. Working on ProjectDetail task table next — adding status pills, priority tags, and due date column.',
		author: 'fred',
		created_ago: 3
	},
	{
		target_type: 'task',
		target_id: taskIds['pm-detail'],
		body: 'Swapped out STATUS_BORDER and STATUS_DOT for getStatusPill and getPriorityTag utilities. The translucent pills look much cleaner than the old colored left borders. Need to verify mobile layout next.',
		author: 'verlbot',
		created_ago: 1
	},
	{
		target_type: 'project',
		target_id: projectIds[19],
		body: 'Register and invokeResult methods implemented and working. Integration tests passing. Ready for code review.',
		author: 'verlbot',
		created_ago: 5
	},
	{
		target_type: 'task',
		target_id: taskIds['canvas-tests'],
		body: 'All 6 test scenarios written and passing. Found and fixed a race condition in the disconnect-during-invoke scenario — was missing cleanup of pending invoke map on unregister.',
		author: 'verlbot',
		created_ago: 2
	},
	{
		target_type: 'project',
		target_id: projectIds[3],
		body: '9 of 11 phases complete. Polish & QA and Search & Navigation remain. Core functionality is solid — users can chat across Discord and dashboard with full sync.',
		author: 'fred',
		created_ago: 7
	},
	{
		target_type: 'project',
		target_id: projectIds[15],
		body: 'Jeff confirmed the rental house in Big Sky. 6 bedrooms, hot tub, mountain views. Going to be epic.',
		author: 'fred',
		created_ago: 8
	},
	{
		target_type: 'project',
		target_id: projectIds[12],
		body: 'The $0 enrollment promo expired on 2/16 but the website says "new member specials available" — worth asking when I tour.',
		author: 'fred',
		created_ago: 2
	},
	{
		target_type: 'project',
		target_id: projectIds[17],
		body: 'Prototyped the routing matrix with a simple decision tree. Works for basic cases but need something more sophisticated for ambiguous tasks. Considering embeddings-based similarity matching.',
		author: 'verlbot',
		created_ago: 6
	},
	{
		target_type: 'task',
		target_id: taskIds['infra-p6'],
		body: 'Queue processor deployed and running. Test support task "Test ticket — verify queue processor" was claimed within 60 seconds and resolved successfully. Cron jobs installed for continuous processing.',
		author: 'verlbot',
		created_ago: 20
	},
	{
		target_type: 'project',
		target_id: projectIds[4],
		body: 'Researched Delaware vs. Wyoming vs. Illinois for LLC formation. Going with Delaware for flexibility — they have the most developed business law and the Court of Chancery is well-regarded. Foreign qualification in IL adds cost but is required since we operate here.',
		author: 'fred',
		created_ago: 15
	}
];

for (const c of comments) {
	insertComment.run(c.target_type, c.target_id, c.body, c.author, ago(c.created_ago));
}
console.log(`  Comments: ${comments.length}`);

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

const insertActivity = db.prepare(`
	INSERT INTO activities (project_id, actor, action, target_type, target_id, target_title, details, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const activities = [
	// Infrastructure Deployment
	{
		projectIdx: 0,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'Infrastructure Deployment — Progress Tracker',
		created_ago: 45
	},
	{
		projectIdx: 0,
		actor: 'verlbot',
		action: 'status_changed',
		target_type: 'task',
		taskKey: 'infra-p1',
		target_title: 'Phase 1: Immediate Deployment',
		details: 'todo → done',
		created_ago: 40
	},
	{
		projectIdx: 0,
		actor: 'verlbot',
		action: 'status_changed',
		target_type: 'task',
		taskKey: 'infra-p6',
		target_title: 'Phase 6: Support Queue Processor',
		details: 'in_progress → done',
		created_ago: 20
	},
	{
		projectIdx: 0,
		actor: 'fred',
		action: 'commented',
		target_type: 'project',
		target_title: 'Infrastructure Deployment — Progress Tracker',
		created_ago: 4
	},
	// Production Readiness
	{
		projectIdx: 1,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'Production Readiness',
		created_ago: 30
	},
	{
		projectIdx: 1,
		actor: 'verlbot',
		action: 'status_changed',
		target_type: 'task',
		taskKey: 'prod-p71',
		target_title: 'Phase 7.1: Monitoring & Alerting',
		details: 'in_progress → done',
		created_ago: 12
	},
	{
		projectIdx: 1,
		actor: 'fred',
		action: 'commented',
		target_type: 'project',
		target_title: 'Production Readiness',
		created_ago: 5
	},
	// Competitive Intelligence
	{
		projectIdx: 2,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'Competitive Intelligence Monitoring',
		created_ago: 20
	},
	{
		projectIdx: 2,
		actor: 'verlbot',
		action: 'status_changed',
		target_type: 'task',
		taskKey: 'intel-scan',
		target_title: 'Set up daily competitor scan cron job',
		details: 'todo → done',
		created_ago: 14
	},
	{
		projectIdx: 2,
		actor: 'fred',
		action: 'commented',
		target_type: 'project',
		target_title: 'Competitive Intelligence Monitoring',
		created_ago: 5
	},
	// Tax
	{
		projectIdx: 11,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'Tax Resolution & Filing',
		created_ago: 40
	},
	{
		projectIdx: 11,
		actor: 'fred',
		action: 'commented',
		target_type: 'task',
		taskKey: 'tax-michael',
		target_title: 'Provide financial info to Michael',
		created_ago: 4
	},
	// Road Trip
	{
		projectIdx: 14,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'Vegas, Tahoe & Palm Springs Road Trip',
		created_ago: 30
	},
	{
		projectIdx: 14,
		actor: 'fred',
		action: 'commented',
		target_type: 'project',
		target_title: 'Vegas, Tahoe & Palm Springs Road Trip',
		created_ago: 12
	},
	// PM Dashboard
	{
		projectIdx: 18,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'PM Dashboard Redesign',
		created_ago: 14
	},
	{
		projectIdx: 18,
		actor: 'verlbot',
		action: 'status_changed',
		target_type: 'task',
		taskKey: 'pm-projectlist',
		target_title: 'ProjectList overhaul',
		details: 'in_progress → done',
		created_ago: 5
	},
	{
		projectIdx: 18,
		actor: 'verlbot',
		action: 'commented',
		target_type: 'task',
		taskKey: 'pm-detail',
		target_title: 'ProjectDetail task table redesign',
		created_ago: 1
	},
	// Canvas Bridge
	{
		projectIdx: 19,
		actor: 'verlbot',
		action: 'created',
		target_type: 'project',
		target_title: 'Gateway Canvas Bridge Plugin',
		created_ago: 21
	},
	{
		projectIdx: 19,
		actor: 'verlbot',
		action: 'status_changed',
		target_type: 'task',
		taskKey: 'canvas-register',
		target_title: 'Implement canvas.bridge.register method',
		details: 'todo → done',
		created_ago: 15
	},
	{
		projectIdx: 19,
		actor: 'verlbot',
		action: 'status_changed',
		target_type: 'task',
		taskKey: 'canvas-invoke',
		target_title: 'Implement canvas.bridge.invokeResult method',
		details: 'todo → done',
		created_ago: 12
	},
	// LLC
	{
		projectIdx: 4,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'LLC Formation & Registration',
		created_ago: 25
	},
	{
		projectIdx: 4,
		actor: 'fred',
		action: 'commented',
		target_type: 'project',
		target_title: 'LLC Formation & Registration',
		created_ago: 15
	},
	// Unified Channel Dashboard
	{
		projectIdx: 3,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'Unified Channel Dashboard',
		created_ago: 50
	},
	{
		projectIdx: 3,
		actor: 'fred',
		action: 'commented',
		target_type: 'project',
		target_title: 'Unified Channel Dashboard',
		created_ago: 7
	},
	// Gym
	{
		projectIdx: 12,
		actor: 'fred',
		action: 'created',
		target_type: 'project',
		target_title: 'Sign Up for West Town Athletic Club',
		created_ago: 18
	}
];

for (const a of activities) {
	const targetId = a.taskKey ? taskIds[a.taskKey] : projectIds[a.projectIdx];
	insertActivity.run(
		projectIds[a.projectIdx],
		a.actor,
		a.action,
		a.target_type,
		targetId,
		a.target_title,
		a.details ?? null,
		ago(a.created_ago)
	);
}
console.log(`  Activities: ${activities.length}`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\nSeed complete! Summary:');
const counts = {
	domains: db.prepare('SELECT COUNT(*) as c FROM domains').get().c,
	focuses: db.prepare('SELECT COUNT(*) as c FROM focuses').get().c,
	milestones: db.prepare('SELECT COUNT(*) as c FROM milestones').get().c,
	projects: db.prepare('SELECT COUNT(*) as c FROM projects').get().c,
	tasks: db.prepare('SELECT COUNT(*) as c FROM tasks').get().c,
	comments: db.prepare('SELECT COUNT(*) as c FROM comments').get().c,
	activities: db.prepare('SELECT COUNT(*) as c FROM activities').get().c,
	blocks: db.prepare('SELECT COUNT(*) as c FROM blocks').get().c,
	fts_entries: db.prepare('SELECT COUNT(*) as c FROM pm_search').get().c
};
console.table(counts);

db.close();
