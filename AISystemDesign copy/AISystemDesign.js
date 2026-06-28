/* ══════════════════════════════════════════════════════════════
   AI AGENT ARCHITECTURE DESIGNER — JavaScript
   Architecture · Options Compare · Cost · Pilot Plan · Recommendations
   Uses window.tool SDK (no DOMContentLoaded, no raw postMessage)
   ══════════════════════════════════════════════════════════════ */

var STATE = {
  activeTab: 'summary', selectedComponent: null, diagramMode: 'dataflow',
  deploymentType: 'cloud', copilotTier: 'studio',
  localModel: 'deepseek-v4-pro', localRuntime: 'ollama',
  cloudProvider: 'anthropic', cloudModelTier: 'balanced',
  temperature: 0.2, maxTokens: 4096,
  agentPersona: 'all',
  systemPrompt: 'You are a helpful AI assistant for {{company_name}}. You have access to the company knowledge base, user-specific memory, and shared organizational memory. Always provide accurate, context-aware responses. If unsure, acknowledge limitations and suggest escalation paths.',
  companyName: 'PKF',
  ragEnabled: 'yes', vectorDb: 'pinecone', embeddingModel: 'text-embedding-3-small',
  chunkSize: 1024, topK: 5, docCount: 50000,
  memoryStrategy: 'external-shared',
  userMemory: 'enabled', userMemoryRetention: '90d',
  companyMemory: 'enabled', appMemory: 'enabled', externalMemory: 'enabled',
  memoryBackend: 'redis',
  mcpEnabled: 'yes',
  mcpTools: ['filesystem', 'database', 'websearch'],
  appConnectors: ['ephorm-audit', 'ephorm-tax'],
  pilotPhase: 'pilot',
  workers: 4, dau: 10, queriesPerUser: 15, avgTokens: 2000,
  useCases: ['event-bot', 'junior-auditor', 'ephorm-audit-ai'],
  readOnly: false, user: null
};

var PRICING = {
  // ── Local / On-Prem models (2026, with full hardware cost breakdown) ──────
  local: {
    'deepseek-v4-pro':  { vram:'48 GB (2× RTX 5090 32GB or A6000 48GB)', gpuCost:9000,  powerW:680,  tokensPerSec:48,  name:'DeepSeek V4 Pro (on-prem, June 2026)',          hardware:'Dual RTX 5090 32GB or A6000 48GB — $9,000–$12,000', firstCost:'$9,000–$12,000', usageCost:'~$85/mo electricity', notes:'Best open-source for coding &amp; reasoning. Can be 4-bit quantized to 24 GB VRAM (RTX 5090 single). 128K context window.' },
    'llama-latest':      { vram:'24 GB (RTX 5090 32GB / Mac Studio M4 Ultra)',  gpuCost:4000,  powerW:380,  tokensPerSec:72,  name:'Llama 4 (Latest — Meta, 2025-2026)',            hardware:'RTX 5090 32GB or Mac Studio M4 Ultra — $4,000–$6,000', firstCost:'$4,000–$6,000', usageCost:'~$50/mo electricity', notes:'Meta\'s latest open-weight. Good all-rounder for daily Q&amp;A, coding, and documents. 32K context. Best value for pilot.' },
    'qwen-latest':       { vram:'48 GB (2× RTX 5090 32GB / A6000)',            gpuCost:8500,  powerW:580,  tokensPerSec:42,  name:'Qwen 3 (Latest — Alibaba, 2026)',              hardware:'Dual RTX 5090 32GB or A6000 48GB — $8,500–$11,000', firstCost:'$8,500–$11,000', usageCost:'~$75/mo electricity', notes:'Strong multilingual &amp; coding. 256K context. Best for documents &amp; cross-language audit work.' },
    'phi4-medium':       { vram:'16 GB (RTX 5080 / Mac M4 Pro)',               gpuCost:1800,  powerW:220,  tokensPerSec:92,  name:'Phi-4 Medium 14B (Microsoft, 2025-2026)',      hardware:'RTX 5080 16GB or Mac M4 Pro — $1,800–$3,000', firstCost:'$1,800–$3,000', usageCost:'~$28/mo electricity', notes:'Best small model. Excellent for laptops &amp; edge devices. 16K context. Great for single-user pilot.' },
    'phi4-mini':         { vram:'4 GB (any laptop / integrated GPU)',           gpuCost:500,   powerW:65,   tokensPerSec:135, name:'Phi-4 Mini 3.8B (Microsoft, 2025-2026)',       hardware:'Any modern laptop — $500 (no extra GPU needed)', firstCost:'$500 (integrated)', usageCost:'~$8/mo electricity', notes:'Runs on ANY device. Perfect for testing, PoC, and offline use. Limited reasoning but fast.' },
    'mistral-small':     { vram:'16 GB (RTX 5080 / Mac M4)',                   gpuCost:1800,  powerW:220,  tokensPerSec:88,  name:'Mistral Small 3.1 22B (2025-2026)',            hardware:'RTX 5080 16GB or Mac M4 — $1,800–$3,000', firstCost:'$1,800–$3,000', usageCost:'~$28/mo electricity', notes:'Efficient French model. Good for structured outputs &amp; JSON. 32K context.' }
  },
  // ── Cloud API providers (REAL June 2026 pricing per million tokens) ──
  // Cache hit = 10% of base (OpenAI/Anthropic), ~2% for DeepSeek
  cloud: {
    'openai': {
      premium:  { input:2.50,  output:15.00,  cachedInput:0.25,  name:'GPT-5.4 (Short context — June 2026)' },
      balanced: { input:0.75,  output:4.50,   cachedInput:0.075, name:'GPT-5.4 Mini (Best value)' },
      budget:   { input:0.20,  output:1.25,   cachedInput:0.02,  name:'GPT-5.4 Nano (Budget)' }
    },
    'anthropic': {
      premium:  { input:5.00,  output:25.00,  cachedInput:0.50,  name:'Claude Opus 4.8 (Best reasoning)' },
      balanced: { input:3.00,  output:15.00,  cachedInput:0.30,  name:'Claude Sonnet 4.6 (Best value)' },
      budget:   { input:1.00,  output:5.00,   cachedInput:0.10,  name:'Claude Haiku 4.5 (Fastest)' }
    },
    'deepseek-cloud': {
      premium:  { input:0.14,  output:0.28,   cachedInput:0.0028, name:'DeepSeek V4 Pro API (50x cache discount!)' },
      balanced: { input:0.14,  output:0.28,   cachedInput:0.0028, name:'DeepSeek V4 Pro (same — one tier)' },
      budget:   { input:0.14,  output:0.28,   cachedInput:0.0028, name:'DeepSeek V4 Pro (same — one tier)' }
    },
    'google': {
      premium:  { input:7.00,  output:21.00,  cachedInput:0.70,  name:'Gemini 3.0 Ultra (Best for code & docs)' },
      balanced: { input:0.10,  output:0.40,   cachedInput:0.01,  name:'Gemini 3.0 Flash (Ultra-fast)' },
      budget:   { input:0.05,  output:0.20,   cachedInput:0.005, name:'Gemini 3.0 Nano (Budget)' }
    },
    'glm': {
      premium:  { input:1.50,  output:6.00,   cachedInput:0.15,  name:'GLM 5.2 (Zhipu AI, 2026)' },
      balanced: { input:0.50,  output:2.00,   cachedInput:0.05,  name:'GLM 5.2 Flash' },
      budget:   { input:0.15,  output:0.60,   cachedInput:0.015, name:'GLM 5.2 Lite' }
    },
    'minimax': {
      premium:  { input:1.00,  output:4.00,   cachedInput:0.10,  name:'MiniMax-M3 (2026)' },
      balanced: { input:0.30,  output:1.20,   cachedInput:0.03,  name:'MiniMax-M3 Flash' },
      budget:   { input:0.08,  output:0.32,   cachedInput:0.008, name:'MiniMax-M3 Nano' }
    },
    'kimi': {
      premium:  { input:0.80,  output:3.20,   cachedInput:0.08,  name:'Kimi Latest (Moonshot AI, 2026)' },
      balanced: { input:0.25,  output:1.00,   cachedInput:0.025, name:'Kimi Flash' },
      budget:   { input:0.06,  output:0.24,   cachedInput:0.006, name:'Kimi Lite' }
    },
    'together': {
      premium:  { input:0.90,  output:0.90,   cachedInput:0.09,  name:'Llama 4 Maverick (Together AI)' },
      balanced: { input:0.20,  output:0.20,   cachedInput:0.02,  name:'DeepSeek V4 Pro (Together AI)' },
      budget:   { input:0.06,  output:0.06,   cachedInput:0.006, name:'Llama 4 Scout (Together AI)' }
    },
    'groq': {
      premium:  { input:0.59,  output:0.79,   cachedInput:0.06,  name:'DeepSeek V4 Pro (Groq)' },
      balanced: { input:0.05,  output:0.08,   cachedInput:0.005, name:'Llama 4 Scout (Groq)' },
      budget:   { input:0.02,  output:0.02,   cachedInput:0.002, name:'Llama 4 Scout Mini (Groq)' }
    },
    'fireworks': {
      premium:  { input:0.90,  output:0.90,   cachedInput:0.09,  name:'Llama 4 Maverick (Fireworks AI)' },
      balanced: { input:0.20,  output:0.20,   cachedInput:0.02,  name:'DeepSeek V4 Pro (Fireworks AI)' },
      budget:   { input:0.06,  output:0.06,   cachedInput:0.006, name:'Llama 4 Scout (Fireworks AI)' }
    }
  },
  embedding: {
    'text-embedding-3-large': { price: 0.13, dims: 3072, provider: 'OpenAI' },
    'text-embedding-3-small': { price: 0.02, dims: 1536, provider: 'OpenAI' },
    'bge-large': { price: 0, dims: 1024, provider: 'Local (Free)' },
    'e5-mistral': { price: 0, dims: 4096, provider: 'Local (Free)' },
    'nomic-embed': { price: 0, dims: 768, provider: 'Local (Free)' }
  },
  vectorDb: {
    'chromadb': { cost: 0, tier: 'Free (Self-Hosted)' },
    'pinecone': { cost: 70, tier: 'Standard Cloud' },
    'weaviate': { cost: 25, tier: 'Cloud Sandbox' },
    'qdrant': { cost: 25, tier: 'Cloud' },
    'pgvector': { cost: 20, tier: 'Managed PostgreSQL' },
    'faiss': { cost: 0, tier: 'Free (Local)' }
  },
  memoryBackend: {
    'redis': { cost: 30, tier: 'Cloud Managed' },
    'postgres': { cost: 20, tier: 'Managed DB' },
    'sqlite': { cost: 0, tier: 'Free (Local)' },
    'mongodb': { cost: 57, tier: 'Atlas M10' },
    'mem0': { cost: 99, tier: 'Platform (Pro)' }
  }
};

var HARDWARE_OPTIONS = [
  { id:'dgx-spark',        name:'NVIDIA DGX Spark (2026)',    spec:'GB10 Superchip · 128 GB unified RAM · NVLink-C2C · 1 TB SSD',               price:3999,  bestFor:'Local LLM pilot — 2-8 users (Llama 4, Phi-4)',  tag:'pilot', icon:'⚡' },
  { id:'mac-studio-m4',    name:'Mac Studio (M4 Ultra, 2026)', spec:'M4 Ultra · 192 GB RAM · 80-core GPU · 8 TB SSD · Thunderbolt 5',           price:5999,  bestFor:'Pilot 5-15 users (Llama 4, DeepSeek V4 Pro)',     tag:'pilot', icon:'🍎' },
  { id:'rtx5090-ws',       name:'RTX 5090 Workstation',       spec:'1× RTX 5090 32 GB · 64 GB RAM · 2 TB NVMe · PCIe 5.0 · 575W TDP',         price:5500,  bestFor:'Single-GPU pilot (Llama 4, Phi-4, Mistral)',      tag:'scale', icon:'🔧' },
  { id:'dual-rtx5090',     name:'Dual RTX 5090 Workstation',  spec:'2× RTX 5090 32 GB (64 GB VRAM) · 128 GB RAM · 4 TB NVMe · 1000W PSU',    price:10500, bestFor:'DeepSeek V4 Pro · Qwen 3 · Large models',          tag:'scale', icon:'🏢' },
  { id:'cloud-only',       name:'Cloud API Only',              spec:'Zero hardware · Pay-per-use · Always latest models (GPT-5.4, Claude 4.8)', price:0,     bestFor:'PoC, variable workloads, instant start',            tag:'pilot', icon:'☁️' },
  { id:'copilot-m365',     name:'Microsoft 365 Copilot',      spec:'M365 E3/E5 · $30/user/mo · Teams · Word · Excel · SharePoint · Graph API', price:0,    bestFor:'M365-native workflows &amp; productivity',            tag:'pilot', icon:'🪟' }
];

var SOFTWARE_STACK = [
  { category:'LLM Model Hosting (2026)', items:[
    { name:'Ollama 0.7+',       desc:'Local LLM server — one command to run DeepSeek V4 Pro, Llama 4, Qwen 3. Industry default for on-prem pilot.', cost:'Free (OSS)' },
    { name:'vLLM 0.7+',        desc:'High-throughput production serving with PagedAttention & continuous batching — 24× faster than naive inference. Supports all major open models.', cost:'Free (OSS)' },
    { name:'LM Studio 0.4+',   desc:'Desktop GUI for local models — great for non-technical team members evaluating models side-by-side.', cost:'Free' }
  ]},
  { category:'Agent Orchestration (2026)', items:[
    { name:'LangGraph 0.3+',       desc:'State-machine agent framework — cycles, human-in-the-loop interrupts, memory, streaming. The industry reference for building reliable agents.', cost:'Free (OSS)' },
    { name:'OpenAI Agents SDK v2',  desc:'Official OpenAI framework — Agents + Handoffs + Guardrails + Tracing. Production-grade with built-in safety.', cost:'Free (OSS)' },
    { name:'Google ADK v2',         desc:'Google Agent Development Kit — multi-agent, A2A (Agent-to-Agent) protocol, Gemini-native, Vertex AI integration.', cost:'Free (OSS)' },
    { name:'Microsoft Copilot Studio', desc:'Low-code agent builder — MCP tool support, M365 Graph connectors, declarative agents, no-code flows.', cost:'$200/mo (tenant)' }
  ]},
  { category:'Vector DB & RAG (2026)', items:[
    { name:'Pinecone Serverless', desc:'Cloud vector DB — hybrid search (dense + sparse), serverless scaling, zero ops. Enterprise #1.', cost:'$70+/mo' },
    { name:'Qdrant Cloud v2',     desc:'Rust vector DB — hybrid + sparse vectors, multi-tenant, self-hostable. Best performance for self-hosted.', cost:'$25+/mo' },
    { name:'ChromaDB / FAISS',    desc:'Local embedding stores — free for dev, PoC, and air-gapped environments. Instant setup.', cost:'Free (OSS)' },
    { name:'Microsoft GraphRAG v2', desc:'Knowledge-graph enhanced RAG — dramatically better multi-hop reasoning over documents. Auto entity extraction.', cost:'Free (OSS)' }
  ]},
  { category:'Memory Systems (2026)', items:[
    { name:'Mem0 v2',       desc:'AI-native memory platform — user preferences, past conversations, extracted facts across ALL apps (web, VS Code, Copilot, custom). Redis-backed.', cost:'$99/mo (Pro)' },
    { name:'Letta (MemGPT) v2', desc:'Long-term stateful agents with persistent hierarchical memory — open-source, self-hostable. Connects to any LLM app.', cost:'Free (OSS)' },
    { name:'Zep v2',        desc:'Enterprise LLM memory — graph storage, entity tracking, semantic search over conversation history. REST API for any app.', cost:'Free / Paid' },
    { name:'Redis Stack',   desc:'Ultra-fast key-value store — can serve as cross-app memory backbone. Any app (web chat, VS Code, Copilot, custom) connects via Redis keys.', cost:'Free / $30 Cloud' }
  ]},
  { category:'Observability & Tracing', items:[
    { name:'LangSmith v2',     desc:'LLM tracing, prompt debugging, evaluation runs, production monitoring — industry reference from LangChain.', cost:'$0–50/mo' },
    { name:'LangFuse v3',     desc:'Open-source LLM observability — full traces, evaluations, cost tracking, self-hostable. GDPR compliant.', cost:'Free (OSS) / Cloud' },
    { name:'Arize Phoenix v2', desc:'Open-source AI observability — OpenTelemetry, LLM traces, RAG quality metrics, drift monitoring.', cost:'Free (OSS)' }
  ]},
  { category:'Guardrails & Safety (2026)', items:[
    { name:'Llama Guard 4',  desc:'Meta\'s latest AI safety classifier — detects harmful prompts & responses. Drop-in filter for any LLM pipeline.', cost:'Free (OSS)' },
    { name:'Guardrails AI v2', desc:'Output validation framework — structured, safe, schema-compliant LLM responses. Policy-as-code.', cost:'Free (OSS) / Paid' },
    { name:'Azure AI Content Safety v2', desc:'Enterprise content filtering — multilingual, real-time moderation, integrated with Azure OpenAI & Foundry.', cost:'Pay-per-use' }
  ]},
  { category:'Access Control & Security', items:[
    { name:'Azure Entra ID',       desc:'Identity & RBAC — M365 integrated, SSO, Conditional Access, PIM for privileged AI access.', cost:'Included w/ M365' },
    { name:'MCP OAuth 2.1',        desc:'Anthropic\'s MCP spec (2026) requires OAuth 2.1 for all tool authorization — prevents unauthorized tool access.', cost:'Dev time' }
  ]}
];

// ── Clean layered layout: 5 horizontal rows, straight vertical + right-angle arrows ──
// Each row is a logical layer. Components flow top→bottom within each layer.
var LAYERS = {
  row1: { y: 15,  h: 62, items: ['user-prompt','agent-workflow','system-prompt'] },
  row2: { y: 105, h: 58, items: ['rag','copilot'] },
  row3: { y: 190, h: 50, items: ['user-memory','company-memory','app-memory','external-memory'] },
  row4: { y: 268, h: 58, items: ['app-connectors','api-mcp','training'] },
  row5: { y: 355, h: 68, items: ['llm-local','llm-cloud','llm-hybrid'] },
  row6: { y: 450, h: 55, items: ['response','review-approval','action'] }
};

var COMPONENTS = [
  // Row 1: INPUT LAYER
  { id: 'user-prompt', label: '1. User Request', row: 'row1', col: 0, w: 160, color: '#6366f1', desc: 'Entry point for every interaction. The user states their goal in natural language — just like briefing a colleague. Industry pattern: all major AI platforms (ChatGPT, Claude, Copilot) start here.' },
  { id: 'agent-workflow', label: '2. Orchestrator', row: 'row1', col: 1, w: 165, color: '#7c3aed', desc: 'The central controller. Industry-standard pattern (Anthropic, Google, OpenAI): receives the goal, plans steps, delegates to specialized agents, and loops until the task is done. Think: project manager for AI agents.' },
  { id: 'system-prompt', label: '3. System Prompt', row: 'row1', col: 2, w: 160, color: '#8b5cf6', desc: 'The AI\'s constitution. Defines role, boundaries, tone, and compliance rules. Industry standard across all LLM platforms — without it, the AI has no guardrails for your business context.' },
  // Row 2: KNOWLEDGE LAYER
  { id: 'rag', label: '4. RAG Pipeline', row: 'row2', col: 0, w: 220, color: '#0891b2', desc: 'Retrieval-Augmented Generation — the industry-standard method (Lewis et al., 2020) for grounding AI in real data. Pipeline: Index → Retrieve → Augment → Generate. Citations back to source documents.' },
  { id: 'copilot', label: '🪟 Copilot Integration', row: 'row2', col: 1, w: 200, color: '#9b59b6', desc: 'Microsoft\'s enterprise AI platform. Built into M365 (Teams, Word, Excel) with Graph connectors for organizational data. Copilot Studio extends with custom agents and MCP tools.' },
  // Row 3: MEMORY LAYER
  { id: 'user-memory', label: '5. User Memory', row: 'row3', col: 0, w: 170, color: '#10b981', desc: 'Remembers your past conversations, preferences, and habits — like an assistant who has worked with you for years.' },
  { id: 'company-memory', label: '6. Company Memory', row: 'row3', col: 1, w: 170, color: '#f59e0b', desc: 'The shared brain of your organization: policies, procedures, brand guidelines, and institutional knowledge.' },
  { id: 'app-memory', label: '7. App Memory', row: 'row3', col: 2, w: 170, color: '#ef4444', desc: 'Each application keeps its own context so audit work and tax work stay separate. Prevents mixing different domains.' },
  { id: 'external-memory', label: '8. External Shared Memory', row: 'row3', col: 3, w: 200, color: '#ec4899', desc: 'A unified memory that connects ALL your apps. Start on web, continue on desktop — context follows you everywhere.' },
  // Row 4: INTEGRATION LAYER
  { id: 'app-connectors', label: '9. App Connectors', row: 'row4', col: 0, w: 180, color: '#dc2626', desc: 'Domain-specific bridges to PKF tools: Ephorm Audit, Ephorm Tax, OpusChart, CaseWare. Each exposes a standardized API that the orchestrator discovers and calls.' },
  { id: 'api-mcp', label: '10. Tool Use / MCP', row: 'row4', col: 1, w: 200, color: '#6366f1', desc: 'Tool Use (OpenAI/Anthropic term) via MCP (Anthropic\'s open protocol). The AI\'s hands: file system, database, web search, email, calendar. Standardized so any model can use any tool.' },
  { id: 'training', label: 'Fine-Tuning', row: 'row4', col: 2, w: 160, color: '#d946ef', desc: 'Model customization spectrum (industry standard): Prompt Engineering → RAG → Fine-Tuning. Fine-tuning is the deepest level — domain-specific training done offline, deployed as model update.' },
  // Row 5: INFERENCE LAYER
  { id: 'llm-local', label: '🖥️ On-Premises LLM', row: 'row5', col: 0, w: 210, color: '#059669', desc: 'Self-hosted inference on your hardware. Industry trend (enterprise AI): full data sovereignty, predictable cost at scale. DGX Spark, Mac Studio, or RTX workstation for DeepSeek V4 Pro / Llama 4 / Qwen 3.' },
  { id: 'llm-cloud', label: '☁️ Cloud LLM API', row: 'row5', col: 1, w: 210, color: '#8b5cf6', desc: 'Inference via API (OpenAI GPT-5.4, Anthropic Claude Opus 4.8, Google Gemini 3.0, DeepSeek Cloud). Industry default: zero infrastructure, pay-per-use, always current models. SOC 2 / ISO 27001 compliant.' },
  { id: 'llm-hybrid', label: '🔀 Hybrid Router', row: 'row5', col: 2, w: 210, color: '#d97706', desc: 'Enterprise pattern: sensitive data stays on-prem, general queries go to cloud. Cost-optimized routing based on data classification and latency requirements.' },
  // Row 6: OUTPUT LAYER — Response first, then human reviews & approves the action, then action executes
  { id: 'response', label: '📤 AI Response', row: 'row6', col: 0, w: 190, color: '#10b981', desc: 'What the user sees — the AI\'s answer. Can be text, a document, a table, or a recommendation. Includes source citations.' },
  { id: 'review-approval', label: '👤 User Review & Approve', row: 'row6', col: 1, w: 200, color: '#f97316', desc: 'A human reviews the AI\'s output and approves the next action. The AI proposes — the human decides. Every approval is logged.' },
  { id: 'action', label: '⚡ Execute Action', row: 'row6', col: 2, w: 180, color: '#ef4444', desc: 'Once approved, the system takes action: files a document, sends an email, updates a record. Fully logged for audit purposes.' }
];

// ── OPTIONS COMPARISON DATA ──
var OPTIONS = [
  { id:'copilot', name:'Microsoft 365 Copilot + Studio', icon:'🪟',
    pros:'Deep M365 integration (Teams, Word, Excel, SharePoint), Graph API connectors for org data, declarative agents, MCP tool support (2026), built-in SOC 2 / ISO 27001 compliance, no infrastructure, $30/user/mo all-inclusive.',
    cons:'Limited to Microsoft ecosystem, Copilot Studio learning curve, per-user cost at scale (>20 users), less model choice, Graph connectors limited to M365 data.',
    security:'⭐⭐⭐⭐⭐', effort:'⭐⭐', scalability:'⭐⭐⭐', fit:'M365-centric / Office power users' },
  { id:'custom', name:'Custom Agent App (LangGraph + MCP)', icon:'🔧',
    pros:'Full control: any LLM (GPT-5.4, Claude Opus 4.8, DeepSeek V4 Pro), LangGraph state-machine workflows, MCP tool ecosystem, human-in-the-loop, OpenTelemetry observability, unlimited integrations, exact cost control.',
    cons:'Needs dev team (Python/TypeScript), 2-4 months to build, ongoing maintenance, security is your responsibility, LangGraph learning curve.',
    security:'⭐⭐⭐', effort:'⭐⭐⭐⭐⭐', scalability:'⭐⭐⭐⭐⭐', fit:'Complex multi-app workflows (recommended for PKF)' },
  { id:'cloud', name:'Cloud LLM API Direct (No Framework)', icon:'☁️',
    pros:'Zero infrastructure, always latest models (GPT-5.4, Claude Opus 4.8, Gemini 3.0), no maintenance, pay-per-use, fastest way to prototype.',
    cons:'Client data leaves your network per API call, costs scale linearly, no persistent memory by default, API rate limits, single vendor dependency risk.',
    security:'⭐⭐⭐', effort:'⭐⭐', scalability:'⭐⭐⭐⭐⭐', fit:'PoC, variable workloads, quick start' },
  { id:'onprem', name:'On-Prem LLM (Ollama / vLLM)', icon:'🖥️',
    pros:'100% data privacy — nothing leaves premises, zero per-token cost at scale, air-gapped possible, DeepSeek V4 Pro / Llama 4 / Qwen 3 available, GDPR/ISO 27001 without DPAs.',
    cons:'Upfront hardware ($1.8K single GPU → $10.5K dual RTX 5090), GPU maintenance, model management overhead, limited to open-weight models, scaling needs more hardware.',
    security:'⭐⭐⭐⭐⭐', effort:'⭐⭐⭐⭐', scalability:'⭐⭐', fit:'Sensitive client data, regulated environments' },
  { id:'hybrid', name:'Hybrid (On-Prem + Cloud Router)', icon:'🔀',
    pros:'Best of both: sensitive audit data stays on-prem, complex reasoning goes to cloud (GPT-5.4/Claude Opus 4.8), LangGraph smart routing, no vendor lock-in, cost-optimized.',
    cons:'More complex setup (two environments), routing logic needs maintenance, higher initial engineering, requires clear data classification policy.',
    security:'⭐⭐⭐⭐', effort:'⭐⭐⭐⭐', scalability:'⭐⭐⭐⭐', fit:'PKF recommended — privacy + capability + cost' }
];

var USE_CASES = [
  { id: 'event-bot', name: 'Event Bot / Event Radar', desc: 'Memory + better search behavior' },
  { id: 'junior-auditor', name: 'Junior Auditor Agent', desc: 'Audit work & document support' },
  { id: 'ephorm-audit-ai', name: 'AI inside Ephorm Audit', desc: 'In-app AI assistance' },
  { id: 'ephorm-tax-ai', name: 'AI inside Ephorm Tax', desc: 'Tax workflow AI support' },
  { id: 'opuschart', name: 'OpusChart Integration', desc: 'Chart data connector' },
  { id: 'caseware', name: 'CaseWare Connector', desc: 'Audit file integration' },
  { id: 'client-knowledge', name: 'Client File / Knowledge Search', desc: 'Unified search across sources' },
  { id: 'doc-request', name: 'Document Request Automation', desc: 'Automated doc retrieval' }
];

var FIT_SCORES = {
  'copilot': { 'event-bot': 4, 'junior-auditor': 3, 'ephorm-audit-ai': 5, 'ephorm-tax-ai': 5, 'opuschart': 2, 'caseware': 2, 'client-knowledge': 4, 'doc-request': 3 },
  'custom':  { 'event-bot': 5, 'junior-auditor': 5, 'ephorm-audit-ai': 4, 'ephorm-tax-ai': 4, 'opuschart': 5, 'caseware': 5, 'client-knowledge': 5, 'doc-request': 5 },
  'cloud':   { 'event-bot': 5, 'junior-auditor': 5, 'ephorm-audit-ai': 4, 'ephorm-tax-ai': 4, 'opuschart': 4, 'caseware': 4, 'client-knowledge': 5, 'doc-request': 5 },
  'onprem':  { 'event-bot': 3, 'junior-auditor': 4, 'ephorm-audit-ai': 3, 'ephorm-tax-ai': 3, 'opuschart': 3, 'caseware': 3, 'client-knowledge': 4, 'doc-request': 4 },
  'hybrid':  { 'event-bot': 5, 'junior-auditor': 5, 'ephorm-audit-ai': 5, 'ephorm-tax-ai': 5, 'opuschart': 5, 'caseware': 5, 'client-knowledge': 5, 'doc-request': 5 }
};

// ── Global Mermaid click handler ─────────────────────────────────────────────
// Mermaid node IDs use underscores; component IDs use hyphens — just replace.
window.onDiagramNodeClick = function(nodeId) {
  selectArchComponent(nodeId.replace(/_/g, '-'));
};

function esc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtCurrency(n) { if (n >= 1000000) return '$'+(n/1000000).toFixed(1)+'M'; if (n >= 1000) return '$'+(n/1000).toFixed(1)+'K'; return '$'+Math.round(n); }
function fmtNum(n) { if (n >= 1000000) return (n/1000000).toFixed(1)+'M'; if (n >= 1000) return (n/1000).toFixed(1)+'K'; return String(Math.round(n)); }

// ═══════════════════════════════════ SDK INIT ═══════════════════════════════════
// ── Robust Mermaid loader for iframe / CMS compatibility ──────────────────────
function loadMermaid(callback) {
  if (window.mermaid) { callback(); return; }
  var urls = [
    'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js',
    'https://unpkg.com/mermaid@11/dist/mermaid.min.js'
  ];
  var tryIdx = 0;
  function tryNext() {
    if (tryIdx >= urls.length) {
      console.warn('Mermaid CDN failed — diagrams will show text fallback');
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = urls[tryIdx];
    script.onload = function() { if (window.mermaid) { initMermaid(); callback(); } else { tryIdx++; tryNext(); } };
    script.onerror = function() { tryIdx++; tryNext(); };
    document.head.appendChild(script);
    tryIdx++;
  }
  tryNext();
}

function initMermaid() {
  if (!window.mermaid) return;
  try {
    mermaid.initialize({
      startOnLoad: false, theme: 'base', securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      themeVariables: {
        fontSize: '13px', primaryColor: '#ede9fe', primaryTextColor: '#3730a3',
        primaryBorderColor: '#7c3aed', lineColor: '#64748b', secondaryColor: '#e0f2fe',
        tertiaryColor: '#f0fdf4', clusterBkg: '#f8fafc', clusterBorder: '#e2e8f0',
        edgeLabelBackground: '#f8fafc', titleColor: '#1e1b4b'
      }
    });
  } catch(e) {
    console.warn('Mermaid init failed:', e);
  }
}

tool.onReady(function(val, fields) {
  // Initialize Mermaid with CDN fallback (works in iframes)
  loadMermaid(function() {
  if (val && typeof val === 'object') restoreState(val);
  STATE.readOnly = tool.isReadOnly(); STATE.user = tool.getUser();

  tool.onValueChange(function(v) { if (v && typeof v === 'object') { restoreState(v); refreshAll(); } });
  tool.onFieldsChange(function(f) {});
  tool.onReadonlyChange(function(ro) { STATE.readOnly = ro; lockUI(ro); refreshAll(); });
  tool.onUserChange(function(u) { STATE.user = u; });

  tool.declareOutput({ type: 'object', properties: { deploymentType:{}, companyName:{}, pilotPhase:{}, dau:{}, useCases:{} } });
  tool.declareParams([{ name:'allowAi', label:'Enable AI', type:'boolean', default:'yes' }, { name:'allowUpload', label:'Enable Upload', type:'boolean', default:'yes' }]);

  initEventListeners();
  syncConfigToUI();
  lockUI(STATE.readOnly);
  refreshAll();
  tool.resize();
  });
});

function restoreState(v) {
  var keys = ['diagramMode','deploymentType','copilotTier','localModel','localRuntime','cloudProvider','cloudModelTier','temperature','maxTokens','agentPersona','systemPrompt','companyName','ragEnabled','vectorDb','embeddingModel','chunkSize','topK','docCount','memoryStrategy','userMemory','userMemoryRetention','companyMemory','appMemory','externalMemory','memoryBackend','mcpEnabled','mcpTools','appConnectors','pilotPhase','workers','dau','queriesPerUser','avgTokens','useCases'];
  for (var i = 0; i < keys.length; i++) { if (v[keys[i]] !== undefined) STATE[keys[i]] = v[keys[i]]; }
}

function saveState() {
  var o = {};
  var keys = ['diagramMode','deploymentType','copilotTier','localModel','localRuntime','cloudProvider','cloudModelTier','temperature','maxTokens','agentPersona','systemPrompt','companyName','ragEnabled','vectorDb','embeddingModel','chunkSize','topK','docCount','memoryStrategy','userMemory','userMemoryRetention','companyMemory','appMemory','externalMemory','memoryBackend','mcpEnabled','mcpTools','appConnectors','pilotPhase','workers','dau','queriesPerUser','avgTokens','useCases'];
  for (var i = 0; i < keys.length; i++) { o[keys[i]] = STATE[keys[i]]; }
  tool.setValue(o);
  tool.resize();
}

function lockUI(ro) {
  var els = document.querySelectorAll('.ai-btn-primary, .ai-input, .ai-textarea, .ai-select, .ai-range, .ai-check input');
  for (var i = 0; i < els.length; i++) { if (ro) els[i].setAttribute('disabled','disabled'); else els[i].removeAttribute('disabled'); }
}

// ═══════════════════════════════════ EVENT LISTENERS ═══════════════════════════════════
function initEventListeners() {
  var tabs = document.querySelectorAll('.ai-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() { switchTab(this.getAttribute('data-tab')); });
  }

  bindChange('cfg-deployment-type', function(v) { STATE.deploymentType = v; syncDeploymentUI(); recalculateAll(); });
  bindChange('cfg-copilot-tier', function(v) { STATE.copilotTier = v; recalculateAll(); });
  bindChange('cfg-local-model', function(v) { STATE.localModel = v; recalculateAll(); });
  bindChange('cfg-local-runtime', function(v) { STATE.localRuntime = v; recalculateAll(); });
  bindChange('cfg-cloud-provider', function(v) { STATE.cloudProvider = v; recalculateAll(); });
  bindChange('cfg-cloud-model', function(v) { STATE.cloudModelTier = v; recalculateAll(); });
  bindInput('cfg-temperature', function(v) { STATE.temperature = parseFloat(v); setText('cfg-temp-val', STATE.temperature.toFixed(1)); recalculateAll(); });
  bindInput('cfg-max-tokens', function(v) { STATE.maxTokens = parseInt(v,10); setText('cfg-tokens-val', fmtNum(STATE.maxTokens)); recalculateAll(); });
  bindChange('cfg-agent-persona', function(v) { STATE.agentPersona = v; });
  bindInput('cfg-system-prompt', function(v) { STATE.systemPrompt = v; });
  bindInput('cfg-company-name', function(v) { STATE.companyName = v; });
  bindChange('cfg-rag-enabled', function(v) { STATE.ragEnabled = v; recalculateAll(); });
  bindChange('cfg-vector-db', function(v) { STATE.vectorDb = v; recalculateAll(); });
  bindChange('cfg-embedding-model', function(v) { STATE.embeddingModel = v; recalculateAll(); });
  bindInput('cfg-chunk-size', function(v) { STATE.chunkSize = parseInt(v,10); setText('cfg-chunk-val', STATE.chunkSize); });
  bindInput('cfg-topk', function(v) { STATE.topK = parseInt(v,10); setText('cfg-topk-val', STATE.topK); });
  bindInput('cfg-doc-count', function(v) { STATE.docCount = parseInt(v,10)||0; recalculateAll(); });
  bindChange('cfg-memory-strategy', function(v) { STATE.memoryStrategy = v; recalculateAll(); });
  bindChange('cfg-user-memory', function(v) { STATE.userMemory = v; recalculateAll(); });
  bindChange('cfg-user-memory-retention', function(v) { STATE.userMemoryRetention = v; recalculateAll(); });
  bindChange('cfg-company-memory', function(v) { STATE.companyMemory = v; recalculateAll(); });
  bindChange('cfg-app-memory', function(v) { STATE.appMemory = v; recalculateAll(); });
  bindChange('cfg-external-memory', function(v) { STATE.externalMemory = v; recalculateAll(); });
  bindChange('cfg-memory-backend', function(v) { STATE.memoryBackend = v; recalculateAll(); });
  bindChange('cfg-mcp-enabled', function(v) { STATE.mcpEnabled = v; recalculateAll(); });
  bindInput('cfg-workers', function(v) { STATE.workers = parseInt(v,10); setText('cfg-workers-val', STATE.workers); });
  bindChange('cfg-pilot-phase', function(v) { STATE.pilotPhase = v; recalculateAll(); });
  bindInput('cfg-dau', function(v) { STATE.dau = parseInt(v,10)||0; recalculateAll(); });
  bindInput('cfg-queries-per-user', function(v) { STATE.queriesPerUser = parseInt(v,10)||0; recalculateAll(); });
  bindInput('cfg-avg-tokens', function(v) { STATE.avgTokens = parseInt(v,10)||0; recalculateAll(); });

  var elApply = document.getElementById('btn-apply-config');
  if (elApply) elApply.addEventListener('click', function() { syncConfigFromUI(); recalculateAll(); saveState(); tool.notify('Configuration applied','success'); });
  var elReset = document.getElementById('btn-reset-config');
  if (elReset) elReset.addEventListener('click', resetConfig);
  var elExport = document.getElementById('btn-export-diagram');
  if (elExport) elExport.addEventListener('click', function() { syncConfigFromUI(); switchTab('plan'); });
  var elCopy = document.getElementById('btn-copy-plan');
  if (elCopy) elCopy.addEventListener('click', copyPlan);
  var elPrint = document.getElementById('btn-print-plan');
  if (elPrint) elPrint.addEventListener('click', function() { window.print(); });
  var elCompare = document.getElementById('btn-compare-recommend');
  if (elCompare) elCompare.addEventListener('click', function() {
    var card = document.getElementById('compare-recommendation-card');
    if (card) { card.style.display = 'block'; card.scrollIntoView({behavior:'smooth'}); }
  });

  var elArchMode = document.getElementById('arch-diagram-mode');
  if (elArchMode) elArchMode.addEventListener('change', function() {
    STATE.diagramMode = this.value;
    STATE.selectedComponent = null;
    renderArchitectureDiagram();
    refreshDetailPanel();
    updateFlowLabel();
    saveState();
  });
  var elCostTf = document.getElementById('cost-timeframe');
  if (elCostTf) elCostTf.addEventListener('change', function() { renderCostView(); });

  // Checkbox groups
  bindCheckGroup('cfg-mcp-tools', 'mcpTools', ['filesystem','database','websearch','github','slack','email','calendar','crm']);
  bindCheckGroup('cfg-app-connectors', 'appConnectors', ['ephorm-audit','ephorm-tax','opuschart','caseware','client-files','knowledge-wiki','custom-apis','saas']);
  bindCheckGroup('cfg-use-cases', 'useCases', ['event-bot','junior-auditor','ephorm-audit-ai','ephorm-tax-ai','opuschart','caseware','client-knowledge','doc-request']);

  // Preset buttons
  var elPresetC = document.getElementById('btn-preset-copilot');
  if (elPresetC) elPresetC.addEventListener('click', function() { applyPreset('copilot'); });
  var elPresetH = document.getElementById('btn-preset-hybrid');
  if (elPresetH) elPresetH.addEventListener('click', function() { applyPreset('hybrid'); });
  var elPresetO = document.getElementById('btn-preset-onprem');
  if (elPresetO) elPresetO.addEventListener('click', function() { applyPreset('onprem'); });
}

function bindChange(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('change', function() { fn(this.value); }); }
function bindInput(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('input', function() { fn(this.value); }); }
function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }

function bindCheckGroup(containerId, stateKey, labels) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener('change', function() {
    var checks = container.querySelectorAll('input[type="checkbox"]');
    STATE[stateKey] = [];
    for (var i = 0; i < checks.length; i++) { if (checks[i].checked && labels[i]) STATE[stateKey].push(labels[i]); }
    recalculateAll();
  });
}

function applyPreset(preset) {
  if (preset === 'copilot') {
    STATE.deploymentType = 'copilot'; STATE.copilotTier = 'studio'; STATE.cloudProvider = 'anthropic';
    STATE.cloudModelTier = 'balanced'; STATE.memoryStrategy = 'copilot-builtin'; STATE.pilotPhase = 'pilot';
    STATE.appConnectors = ['ephorm-audit','ephorm-tax'];
    STATE.useCases = ['event-bot','ephorm-audit-ai','ephorm-tax-ai'];
  } else if (preset === 'hybrid') {
    STATE.deploymentType = 'hybrid'; STATE.localModel = 'deepseek-v4-pro'; STATE.cloudProvider = 'anthropic';
    STATE.cloudModelTier = 'balanced'; STATE.memoryStrategy = 'external-shared'; STATE.pilotPhase = 'pilot';
    STATE.appConnectors = ['ephorm-audit','ephorm-tax','caseware'];
    STATE.useCases = ['event-bot','junior-auditor','ephorm-audit-ai'];
  } else if (preset === 'onprem') {
    STATE.deploymentType = 'local'; STATE.localModel = 'deepseek-v4-pro'; STATE.localRuntime = 'ollama';
    STATE.memoryStrategy = 'external-shared'; STATE.vectorDb = 'chromadb'; STATE.embeddingModel = 'bge-large';
    STATE.memoryBackend = 'sqlite'; STATE.pilotPhase = 'pilot';
    STATE.appConnectors = ['ephorm-audit','ephorm-tax'];
    STATE.useCases = ['junior-auditor','ephorm-audit-ai'];
  }
  syncConfigToUI(); syncDeploymentUI(); recalculateAll(); saveState();
  tool.notify(preset.charAt(0).toUpperCase() + preset.slice(1) + ' preset applied', 'success');
}

// ═══════════════════════════════════ TAB NAV ═══════════════════════════════════
function switchTab(tabName) {
  STATE.activeTab = tabName;
  var tabs = document.querySelectorAll('.ai-tab');
  for (var i = 0; i < tabs.length; i++) { tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabName); }
  var views = document.querySelectorAll('.ai-view');
  for (var j = 0; j < views.length; j++) { views[j].classList.toggle('active', views[j].id === 'view-' + tabName); }
  if (tabName === 'summary') { renderSummaryView(); }
  if (tabName === 'architecture') { renderArchitectureDiagram(); updateFlowLabel(); }
  if (tabName === 'memory') renderMemoryView();
  if (tabName === 'gpu') {}
  if (tabName === 'deepseek') {}
  if (tabName === 'tokencost') {} // Static content — no dynamic render needed
  if (tabName === 'configure') syncConfigToUI();
  if (tabName === 'compare') renderCompareView();
  if (tabName === 'cost') renderCostView();
  if (tabName === 'plan') renderPlanView();
  tool.resize();
}

function refreshAll() {
  updateBadges();
  if (STATE.activeTab === 'summary') renderSummaryView();
  if (STATE.activeTab === 'architecture') renderArchitectureDiagram();
  if (STATE.activeTab === 'memory') renderMemoryView();
  if (STATE.activeTab === 'compare') renderCompareView();
  if (STATE.activeTab === 'cost') renderCostView();
  if (STATE.activeTab === 'plan') renderPlanView();
}

function updateBadges() {
  var bt = document.getElementById('badge-deployment-type');
  if (bt) { var map = { local:'🖥️ On-Prem', cloud:'☁️ Cloud', hybrid:'🔀 Hybrid', copilot:'🪟 Copilot' }; bt.textContent = map[STATE.deploymentType] || '☁️ Cloud'; }
  var bc = document.getElementById('badge-est-cost');
  if (bc) { var c = calcCosts(); bc.textContent = fmtCurrency(c.totalMonthly) + '/mo'; }
  var bp = document.getElementById('badge-pilot-users');
  if (bp) { var pm = { poc:'2-3 PoC', pilot:'5-10 Pilot', scale:'20+ Scale', production:'50+ Prod' }; bp.textContent = pm[STATE.pilotPhase] || '5-10 Pilot'; }
}

// ═══════════════════════════════════ SYNC ═══════════════════════════════════
function syncConfigToUI() {
  setVal('cfg-deployment-type', STATE.deploymentType);
  setVal('cfg-copilot-tier', STATE.copilotTier);
  setVal('cfg-local-model', STATE.localModel);
  setVal('cfg-local-runtime', STATE.localRuntime);
  setVal('cfg-cloud-provider', STATE.cloudProvider);
  setVal('cfg-cloud-model', STATE.cloudModelTier);
  setVal('cfg-temperature', STATE.temperature);
  setVal('cfg-max-tokens', STATE.maxTokens);
  setVal('cfg-agent-persona', STATE.agentPersona);
  setVal('cfg-system-prompt', STATE.systemPrompt);
  setVal('cfg-company-name', STATE.companyName);
  setVal('cfg-rag-enabled', STATE.ragEnabled);
  setVal('cfg-vector-db', STATE.vectorDb);
  setVal('cfg-embedding-model', STATE.embeddingModel);
  setVal('cfg-chunk-size', STATE.chunkSize);
  setVal('cfg-topk', STATE.topK);
  setVal('cfg-doc-count', STATE.docCount);
  setVal('cfg-memory-strategy', STATE.memoryStrategy);
  setVal('cfg-user-memory', STATE.userMemory);
  setVal('cfg-user-memory-retention', STATE.userMemoryRetention);
  setVal('cfg-company-memory', STATE.companyMemory);
  setVal('cfg-app-memory', STATE.appMemory);
  setVal('cfg-external-memory', STATE.externalMemory);
  setVal('cfg-memory-backend', STATE.memoryBackend);
  setVal('cfg-mcp-enabled', STATE.mcpEnabled);
  setVal('cfg-workers', STATE.workers);
  setVal('cfg-pilot-phase', STATE.pilotPhase);
  setVal('cfg-dau', STATE.dau);
  setVal('cfg-queries-per-user', STATE.queriesPerUser);
  setVal('cfg-avg-tokens', STATE.avgTokens);
  setText('cfg-temp-val', STATE.temperature.toFixed(1));
  setText('cfg-tokens-val', fmtNum(STATE.maxTokens));
  setText('cfg-chunk-val', STATE.chunkSize);
  setText('cfg-topk-val', STATE.topK);
  setText('cfg-workers-val', STATE.workers);
  syncCheckGroup('cfg-mcp-tools', STATE.mcpTools, ['filesystem','database','websearch','github','slack','email','calendar','crm']);
  syncCheckGroup('cfg-app-connectors', STATE.appConnectors, ['ephorm-audit','ephorm-tax','opuschart','caseware','client-files','knowledge-wiki','custom-apis','saas']);
  syncCheckGroup('cfg-use-cases', STATE.useCases, ['event-bot','junior-auditor','ephorm-audit-ai','ephorm-tax-ai','opuschart','caseware','client-knowledge','doc-request']);
  syncDeploymentUI();
}

function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
function syncCheckGroup(containerId, arr, labels) {
  var checks = document.querySelectorAll('#' + containerId + ' input[type="checkbox"]');
  for (var i = 0; i < checks.length; i++) { checks[i].checked = arr.indexOf(labels[i]) !== -1; }
}

function syncDeploymentUI() {
  var isCopilot = STATE.deploymentType === 'copilot';
  var isLocal = STATE.deploymentType === 'local' || STATE.deploymentType === 'hybrid';
  var isCloud = STATE.deploymentType === 'cloud' || STATE.deploymentType === 'hybrid' || STATE.deploymentType === 'copilot';
  toggleDisplay('cfg-copilot-group', isCopilot);
  toggleDisplay('cfg-local-model-group', isLocal);
  toggleDisplay('cfg-local-runtime-group', isLocal);
  toggleDisplay('cfg-cloud-provider-group', isCloud);
  toggleDisplay('cfg-cloud-model-group', isCloud);
}

function toggleDisplay(id, show) { var el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; }

function syncConfigFromUI() {
  STATE.deploymentType = getVal('cfg-deployment-type');
  STATE.copilotTier = getVal('cfg-copilot-tier');
  STATE.localModel = getVal('cfg-local-model');
  STATE.localRuntime = getVal('cfg-local-runtime');
  STATE.cloudProvider = getVal('cfg-cloud-provider');
  STATE.cloudModelTier = getVal('cfg-cloud-model');
  STATE.temperature = parseFloat(getVal('cfg-temperature')) || 0.7;
  STATE.maxTokens = parseInt(getVal('cfg-max-tokens'),10) || 4096;
  STATE.agentPersona = getVal('cfg-agent-persona');
  STATE.systemPrompt = getVal('cfg-system-prompt');
  STATE.companyName = getVal('cfg-company-name');
  STATE.ragEnabled = getVal('cfg-rag-enabled');
  STATE.vectorDb = getVal('cfg-vector-db');
  STATE.embeddingModel = getVal('cfg-embedding-model');
  STATE.chunkSize = parseInt(getVal('cfg-chunk-size'),10) || 1024;
  STATE.topK = parseInt(getVal('cfg-topk'),10) || 5;
  STATE.docCount = parseInt(getVal('cfg-doc-count'),10) || 0;
  STATE.memoryStrategy = getVal('cfg-memory-strategy');
  STATE.userMemory = getVal('cfg-user-memory');
  STATE.userMemoryRetention = getVal('cfg-user-memory-retention');
  STATE.companyMemory = getVal('cfg-company-memory');
  STATE.appMemory = getVal('cfg-app-memory');
  STATE.externalMemory = getVal('cfg-external-memory');
  STATE.memoryBackend = getVal('cfg-memory-backend');
  STATE.mcpEnabled = getVal('cfg-mcp-enabled');
  STATE.workers = parseInt(getVal('cfg-workers'),10) || 4;
  STATE.pilotPhase = getVal('cfg-pilot-phase');
  STATE.dau = parseInt(getVal('cfg-dau'),10) || 0;
  STATE.queriesPerUser = parseInt(getVal('cfg-queries-per-user'),10) || 0;
  STATE.avgTokens = parseInt(getVal('cfg-avg-tokens'),10) || 0;
  // Checkbox groups synced via change listeners
}

function getVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }

function resetConfig() {
  STATE.deploymentType = 'cloud'; STATE.copilotTier = 'studio'; STATE.localModel = 'deepseek-v4-pro';
  STATE.cloudProvider = 'anthropic'; STATE.cloudModelTier = 'balanced'; STATE.agentPersona = 'all';
  STATE.ragEnabled = 'yes'; STATE.vectorDb = 'pinecone'; STATE.embeddingModel = 'text-embedding-3-small';
  STATE.memoryStrategy = 'external-shared'; STATE.memoryBackend = 'redis';
  STATE.mcpTools = ['filesystem','database','websearch'];
  STATE.appConnectors = ['ephorm-audit','ephorm-tax'];
  STATE.pilotPhase = 'pilot'; STATE.dau = 10; STATE.queriesPerUser = 15; STATE.avgTokens = 2000;
  STATE.useCases = ['event-bot','junior-auditor','ephorm-audit-ai'];
  syncConfigToUI(); syncDeploymentUI(); recalculateAll(); saveState();
  tool.notify('Configuration reset', 'info');
}

function recalculateAll() { saveState(); updateBadges(); refreshAll(); }

// ═══════════════════════════════════ COST CALC ═══════════════════════════════════
function calcCosts() {
  if (STATE.deploymentType === 'copilot') return calcCopilotCosts();
  var dailyQ = STATE.dau * STATE.queriesPerUser;
  var monthlyQ = dailyQ * 30;
  var totalTok = monthlyQ * STATE.avgTokens;
  var inTokM = totalTok * 0.6 / 1000000;
  var outTokM = totalTok * 0.4 / 1000000;

  var cloudP = (PRICING.cloud[STATE.cloudProvider]||{})[STATE.cloudModelTier] || null;
  var cloudCost = cloudP ? (inTokM * cloudP.input + outTokM * cloudP.output) : 0;

  var localP = PRICING.local[STATE.localModel] || PRICING.local['deepseek-v4-pro'];
  var gpuAmort = localP.gpuCost / 36;
  var powerCost = (localP.powerW/1000) * 24 * 30 * 0.12;
  var maint = 50; // Occasional IT support + cooling for single GPU workstation
  var localCost = gpuAmort + powerCost + maint;

  var ragCost = 0;
  var embP = PRICING.embedding[STATE.embeddingModel];
  if (embP && embP.price > 0) ragCost += (STATE.chunkSize * STATE.docCount / 1000000) * embP.price;
  var vecP = PRICING.vectorDb[STATE.vectorDb];
  if (vecP && vecP.cost > 0) ragCost += vecP.cost;

  var memCost = 0;
  var memP = PRICING.memoryBackend[STATE.memoryBackend];
  if (memP && memP.cost > 0) memCost += memP.cost;
  if (STATE.externalMemory === 'enabled') memCost += 15;

  var mcpCost = 0;
  if (STATE.mcpEnabled === 'yes') { mcpCost += STATE.mcpTools.length * 5 + STATE.appConnectors.length * 8; }
  var infraCost = 30;

  var totalLocal = localCost + ragCost + memCost + mcpCost + infraCost;
  var totalCloud = cloudCost + ragCost + memCost + mcpCost + infraCost;
  var totalHybrid = totalLocal * 0.5 + totalCloud * 0.5 + 50;

  var total = totalCloud;
  if (STATE.deploymentType === 'local') total = totalLocal;
  else if (STATE.deploymentType === 'hybrid') total = totalHybrid;

  return {
    dailyQueries: dailyQ, monthlyQueries: monthlyQ, totalTokensPerMonth: totalTok,
    cloudCost: cloudCost, localCost: localCost, hybridCost: totalHybrid,
    ragCost: ragCost, memoryCost: memCost, mcpCost: mcpCost, infraCost: infraCost,
    gpuAmortizedMonthly: gpuAmort, powerCostMonthly: powerCost, maintenanceMonthly: maint,
    localHardwareCost: localP.gpuCost,
    totalMonthly: total, totalAnnual: total*12, total3Year: total*36,
    localAnnual: totalLocal*12, cloudAnnual: totalCloud*12
  };
}

function calcCopilotCosts() {
  var users = STATE.dau;
  var copilotLicense = users * 30; // $30/user/mo M365 Copilot
  var studioCost = STATE.copilotTier === 'studio' ? 200 : 0; // Copilot Studio tenant
  var ragCost = 50; // Minimal RAG via Graph connectors
  var memCost = 20;
  var total = copilotLicense + studioCost + ragCost + memCost + 30;
  return {
    dailyQueries: users * STATE.queriesPerUser, monthlyQueries: users * STATE.queriesPerUser * 30,
    totalTokensPerMonth: 0, cloudCost: copilotLicense + studioCost, localCost: 0, hybridCost: 0,
    ragCost: ragCost, memoryCost: memCost, mcpCost: 0, infraCost: 30,
    gpuAmortizedMonthly: 0, powerCostMonthly: 0, maintenanceMonthly: 0, localHardwareCost: 0,
    totalMonthly: total, totalAnnual: total*12, total3Year: total*36, localAnnual: 0, cloudAnnual: total*12
  };
}

// ═══════════════════════════════════ ARCHITECTURE DIAGRAM ═══════════════════════════════════
function renderArchitectureDiagram() {
  if (STATE.diagramMode === 'agentic') { renderAgenticFlowDiagram(); return; }
  if (STATE.diagramMode === 'assembly') { renderPromptAssemblyDiagram(); return; }
  if (STATE.diagramMode === 'localFlow') { renderLocalFlowDiagram(); return; }
  if (STATE.diagramMode === 'cloudFlow') { renderCloudFlowDiagram(); return; }
  renderDataFlowDiagram();
}

function renderDataFlowDiagram() {
  var container = document.getElementById('arch-diagram-svg');
  if (!container) return;
  if (!window.mermaid) {
    container.innerHTML = '<div class="ai-empty" style="padding:40px;text-align:center">⏳ Loading Mermaid diagram library… Please refresh if this persists.</div>';
    return;
  }

  var sel = STATE.selectedComponent ? STATE.selectedComponent.replace(/-/g, '_') : '';
  function nc(id, def) { return '  class ' + id + ' ' + (sel === id ? 'activeComp' : def); }

  var diagramDef = [
    'flowchart TB',
    '  classDef input       fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3',
    '  classDef knowledge   fill:#e0f2fe,stroke:#0891b2,stroke-width:2px,color:#164e63',
    '  classDef memory      fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef integration fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d',
    '  classDef inference   fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f',
    '  classDef output      fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef activeComp  fill:#e0e7ff,stroke:#6366f1,stroke-width:4px,color:#1e1b4b',
    '',
    '  subgraph A["📥 INPUT LAYER — What you ask and how the AI is configured"]',
    '    user_prompt["👤 User Request<br/>Natural language goal or question"]',
    '    agent_workflow["🧠 Orchestrator<br/>Plans · Delegates · Evaluates · Loops"]',
    '    system_prompt["📋 System Prompt<br/>AI rules, role &amp; company context"]',
    '    user_prompt --> agent_workflow --> system_prompt',
    '  end',
    '',
    '  subgraph B["📚 KNOWLEDGE LAYER — Gives the AI access to your organization\'s data"]',
    '    rag["🔍 RAG Pipeline<br/>Index → Retrieve → Re-rank → Augment"]',
    '    copilot["🪟 Microsoft Copilot<br/>M365 · Teams · SharePoint · Graph API"]',
    '    copilot -.-> rag',
    '  end',
    '',
    '  subgraph C["🧠 MEMORY LAYER — What the AI remembers across conversations"]',
    '    user_memory["👤 User Memory<br/>Your history &amp; preferences"]',
    '    company_memory["🏢 Company Memory<br/>Shared policies &amp; knowledge"]',
    '    app_memory["📱 App Memory<br/>Per-application context"]',
    '    external_memory["🌐 Shared Memory<br/>Cross-app unified context"]',
    '  end',
    '',
    '  subgraph D["🔌 INTEGRATION LAYER — Connects AI to your existing tools"]',
    '    app_connectors["🔗 App Connectors<br/>Ephorm · CaseWare · OpusChart"]',
    '    api_mcp["🔧 Tool Use / MCP<br/>Files · Databases · APIs · Email"]',
    '    training["🎓 Fine-Tuning<br/>Domain specialization layer"]',
    '    app_connectors --> api_mcp',
    '    training -.-> api_mcp',
    '  end',
    '',
    '  subgraph E["⚡ INFERENCE LAYER — The AI model that processes everything"]',
    '    llm_local["🖥️ On-Prem LLM<br/>DeepSeek V4 Pro · Llama 4 · Qwen 3"]',
    '    llm_cloud["☁️ Cloud LLM API<br/>GPT-5.4 · Claude Opus 4.8 · Gemini 3.0"]',
    '    llm_hybrid["🔀 Hybrid Router<br/>Sensitive data local · Complex tasks cloud"]',
    '  end',
    '',
    '  subgraph F["✅ OUTPUT LAYER — Response · Human Approval · Action"]',
    '    response["📤 AI Response<br/>Answer with source citations"]',
    '    review_approval["👤 Human Review &amp; Approve<br/>You decide what action to take"]',
    '    action["⚡ Execute Action<br/>Filed · Sent · Logged · Auditable"]',
    '    response --> review_approval --> action',
    '  end',
    '',
    '  %% Main pipeline flow (top to bottom)',
    '  A --> B',
    '  B --> D',
    '  user_memory & company_memory & app_memory & external_memory -.-> rag',
    '  api_mcp --> llm_local & llm_cloud & llm_hybrid',
    '  llm_local & llm_cloud & llm_hybrid --> response',
    '',
    '  %% Click handlers — calls window.onDiagramNodeClick(nodeId)',
    '  click user_prompt onDiagramNodeClick',
    '  click agent_workflow onDiagramNodeClick',
    '  click system_prompt onDiagramNodeClick',
    '  click rag onDiagramNodeClick',
    '  click copilot onDiagramNodeClick',
    '  click user_memory onDiagramNodeClick',
    '  click company_memory onDiagramNodeClick',
    '  click app_memory onDiagramNodeClick',
    '  click external_memory onDiagramNodeClick',
    '  click app_connectors onDiagramNodeClick',
    '  click api_mcp onDiagramNodeClick',
    '  click training onDiagramNodeClick',
    '  click llm_local onDiagramNodeClick',
    '  click llm_cloud onDiagramNodeClick',
    '  click llm_hybrid onDiagramNodeClick',
    '  click response onDiagramNodeClick',
    '  click review_approval onDiagramNodeClick',
    '  click action onDiagramNodeClick',
    '',
    '  %% Node styling',
    nc('user_prompt', 'input'),
    nc('agent_workflow', 'input'),
    nc('system_prompt', 'input'),
    nc('rag', 'knowledge'),
    nc('copilot', 'knowledge'),
    nc('user_memory', 'memory'),
    nc('company_memory', 'memory'),
    nc('app_memory', 'memory'),
    nc('external_memory', 'memory'),
    nc('app_connectors', 'integration'),
    nc('api_mcp', 'integration'),
    nc('training', 'integration'),
    nc('llm_local', 'inference'),
    nc('llm_cloud', 'inference'),
    nc('llm_hybrid', 'inference'),
    nc('response', 'output'),
    nc('review_approval', 'output'),
    nc('action', 'output')
  ].join('\n');

  container.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px">⏳ Rendering diagram…</div>';
  var diagId = 'df' + Date.now();
  mermaid.render(diagId, diagramDef).then(function(result) {
    container.innerHTML = result.svg;
    if (result.bindFunctions) result.bindFunctions(container);
    if (STATE.selectedComponent) refreshDetailPanel();
  }).catch(function(err) {
    console.error('Mermaid dataflow error:', err);
    container.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px">⚠️ Diagram render error: ' + esc(String(err.message || err)) + '</div>';
  });
}

// ═══════════════════════════════════ AGENTIC FLOW DIAGRAM (Mermaid) ════════════════════════════
function renderAgenticFlowDiagram() {
  var container = document.getElementById('arch-diagram-svg');
  if (!container) return;
  if (!window.mermaid) {
    container.innerHTML = '<div class="ai-empty" style="padding:40px;text-align:center">⏳ Loading Mermaid diagram library…</div>';
    return;
  }

  var sel = STATE.selectedComponent ? STATE.selectedComponent.replace(/-/g, '_') : '';
  function nc(id, def) { return '  class ' + id + ' ' + (sel === id ? 'activeComp' : def); }

  var diagramDef = [
    'flowchart TB',
    '  classDef user       fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3',
    '  classDef orch       fill:#7c3aed,stroke:#5b21b6,stroke-width:2px,color:#fff',
    '  classDef worker     fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef shared     fill:#fce7f3,stroke:#be185d,stroke-width:2px,color:#831843',
    '  classDef output     fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef activeComp fill:#e0e7ff,stroke:#6366f1,stroke-width:4px,color:#1e1b4b',
    '',
    '  agent_user["👤 User Goal / Task<br/>States objective in natural language"]',
    '  agent_orch["🧠 Orchestrator Agent<br/>Plans → Delegates → Evaluates → Loops until complete<br/>(Anthropic Orchestrator-Workers pattern, 2024)"]',
    '',
    '  subgraph WORKERS["🔧 Worker Agents — Each specialized for a different task"]',
    '    agent_doer["👤 Doer Agent<br/>Drafts documents, runs queries, extracts data"]',
    '    agent_reviewer["🔍 Reviewer Agent<br/>Validates output against standards &amp; policies"]',
    '    agent_tools["🔧 Tool Agent / MCP<br/>Calls APIs · Reads files · Queries databases"]',
    '    agent_manager["👔 Manager Agent<br/>Decisions · Approvals · Human escalation"]',
    '  end',
    '',
    '  subgraph SHARED["🧠 Shared Context — All agents see the same knowledge"]',
    '    agent_memory["🧠 Shared Memory + RAG<br/>User history · Company policies · Retrieved documents"]',
    '    agent_loop["🔄 Evaluation Loop<br/>Goal complete? YES → respond · NO → next task"]',
    '  end',
    '',
    '  subgraph OUT["✅ Output — Response → Human Approval → Action"]',
    '    agent_response["📤 Final Response<br/>Assembled output with citations"]',
    '    agent_approval["👤 Human Approval Gate<br/>You approve before any action is taken"]',
    '    agent_action["⚡ Execute Action<br/>Logged · Attributable · Reversible"]',
    '    agent_response --> agent_approval --> agent_action',
    '  end',
    '',
    '  agent_user --> agent_orch',
    '  agent_orch --> agent_doer & agent_reviewer & agent_tools & agent_manager',
    '  agent_doer & agent_reviewer & agent_tools & agent_manager --> agent_memory',
    '  agent_memory --> agent_loop',
    '  agent_loop -->|"✓ Complete"| agent_response',
    '  agent_loop -->|"↺ Not done"| agent_orch',
    '',
    '  click agent_user onDiagramNodeClick',
    '  click agent_orch onDiagramNodeClick',
    '  click agent_doer onDiagramNodeClick',
    '  click agent_reviewer onDiagramNodeClick',
    '  click agent_tools onDiagramNodeClick',
    '  click agent_manager onDiagramNodeClick',
    '  click agent_memory onDiagramNodeClick',
    '  click agent_loop onDiagramNodeClick',
    '  click agent_response onDiagramNodeClick',
    '  click agent_approval onDiagramNodeClick',
    '  click agent_action onDiagramNodeClick',
    '',
    nc('agent_user', 'user'),
    nc('agent_orch', 'orch'),
    nc('agent_doer', 'worker'),
    nc('agent_reviewer', 'worker'),
    nc('agent_tools', 'worker'),
    nc('agent_manager', 'worker'),
    nc('agent_memory', 'shared'),
    nc('agent_loop', 'shared'),
    nc('agent_response', 'output'),
    nc('agent_approval', 'output'),
    nc('agent_action', 'output')
  ].join('\n');

  container.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px">⏳ Rendering diagram…</div>';
  var diagId = 'ag' + Date.now();
  mermaid.render(diagId, diagramDef).then(function(result) {
    container.innerHTML = result.svg;
    if (result.bindFunctions) result.bindFunctions(container);
    if (STATE.selectedComponent) refreshAgentDetailPanel();
  }).catch(function(err) {
    console.error('Mermaid agentic error:', err);
    container.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px">⚠️ Diagram render error: ' + esc(String(err.message || err)) + '</div>';
  });
}

// ═══════════════════════════════════ PROMPT ASSEMBLY DIAGRAM (Mermaid) ══════════════════════════
function renderPromptAssemblyDiagram() {
  var container = document.getElementById('arch-diagram-svg');
  if (!container) return;
  if (!window.mermaid) {
    container.innerHTML = '<div class="ai-empty" style="padding:40px;text-align:center">⏳ Loading Mermaid diagram library…</div>';
    return;
  }

  var sel = STATE.selectedComponent ? STATE.selectedComponent.replace(/-/g, '_') : '';
  function nc(id, def) { return '  class ' + id + ' ' + (sel === id ? 'activeComp' : def); }

  var diagramDef = [
    'flowchart LR',
    '  classDef source     fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3',
    '  classDef combine    fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#78350f',
    '  classDef model      fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d',
    '  classDef output     fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef activeComp fill:#e0e7ff,stroke:#6366f1,stroke-width:4px,color:#1e1b4b',
    '',
    '  subgraph SOURCES["📥 4 Data Sources — Combined before the AI processes anything"]',
    '    asm_user["👤 1. User Input<br/>What you typed or asked<br/>Example: Draft audit memo for client XYZ"]',
    '    asm_system["📋 2. System Prompt<br/>AI\'s permanent job description<br/>Role · Rules · Tone · Boundaries"]',
    '    asm_rag["📚 3. RAG Pipeline (Lewis et al. 2020)<br/>Documents retrieved from knowledge base<br/>Index → Retrieve → Re-rank → Augment"]',
    '    asm_memory["🧠 4. Memory Context<br/>Past conversations &amp; learned facts<br/>Preferences · Previous topics · Entity facts"]',
    '  end',
    '',
    '  asm_combined["📦 Combined Prompt<br/>All 4 sources merged into<br/>one structured input the LLM receives"]',
    '  asm_llm["🧠 LLM — AI Model<br/>GPT-5.4 · Claude Opus 4.8 · Gemini 3.0<br/>Processes the combined prompt"]',
    '  asm_response["📤 Final Response<br/>Answer + source citations<br/>Context-aware &amp; personalized"]',
    '',
    '  asm_user --> asm_combined',
    '  asm_system --> asm_combined',
    '  asm_rag --> asm_combined',
    '  asm_memory --> asm_combined',
    '  asm_combined --> asm_llm',
    '  asm_llm --> asm_response',
    '',
    '  click asm_user onDiagramNodeClick',
    '  click asm_system onDiagramNodeClick',
    '  click asm_rag onDiagramNodeClick',
    '  click asm_memory onDiagramNodeClick',
    '  click asm_combined onDiagramNodeClick',
    '  click asm_llm onDiagramNodeClick',
    '  click asm_response onDiagramNodeClick',
    '',
    nc('asm_user', 'source'),
    nc('asm_system', 'source'),
    nc('asm_rag', 'source'),
    nc('asm_memory', 'source'),
    nc('asm_combined', 'combine'),
    nc('asm_llm', 'model'),
    nc('asm_response', 'output')
  ].join('\n');

  container.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px">⏳ Rendering diagram…</div>';
  var diagId = 'asm' + Date.now();
  mermaid.render(diagId, diagramDef).then(function(result) {
    container.innerHTML = result.svg;
    if (result.bindFunctions) result.bindFunctions(container);
    if (STATE.selectedComponent) refreshAssemblyDetailPanel();
  }).catch(function(err) {
    console.error('Mermaid assembly error:', err);
    container.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px">⚠️ Diagram render error: ' + esc(String(err.message || err)) + '</div>';
  });
}

function findPromptBox(boxes, id) { for (var i=0;i<boxes.length;i++) { if (boxes[i].id===id) return boxes[i]; } return null; }

// ═══════════════════════════════════ LOCAL LLM FLOW DIAGRAM ════════════════════════
function renderLocalFlowDiagram() {
  var container = document.getElementById('arch-diagram-svg');
  if (!container) return;
  if (!window.mermaid) {
    container.innerHTML = '<div class="ai-empty" style="padding:40px;text-align:center">⏳ Loading Mermaid…</div>';
    return;
  }

  var localP = PRICING.local[STATE.localModel] || PRICING.local['deepseek-v4-pro'];

  var diagramDef = [
    'flowchart TB',
    '  classDef userIn    fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3',
    '  classDef prompt    fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f',
    '  classDef tools     fill:#e0f2fe,stroke:#0891b2,stroke-width:2px,color:#164e63',
    '  classDef localLLM  fill:#059669,stroke:#047857,stroke-width:3px,color:#fff',
    '  classDef hardware  fill:#fce7f3,stroke:#be185d,stroke-width:2px,color:#831843',
    '  classDef output    fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef boundary  fill:#f8fafc,stroke:#059669,stroke-width:2px,stroke-dasharray:6 3,color:#065f46',
    '',
    '  subgraph BOUNDARY["🔒 YOUR NETWORK — All data stays on-premises · Nothing leaves your hardware"]',
    '    direction TB',
    '',
    '    user["👤 User Query<br/>Natural language request"]',
    '',
    '    subgraph PROMPT["📦 Prompt Assembly — ALL context combined here<br/>System Prompt (rules &amp; tone) + RAG (your documents) + Memory (past conversations) + User Input"]',
    '      prompt_combined["⚙️ Assembled Prompt<br/>The AI receives ONE complete, structured input<br/>containing everything it needs to answer accurately"]',
    '    end',
    '',
    '    subgraph AGENT["🧠 Agent Orchestrator — Plans → Delegates → Evaluates → Loops"]',
    '      orchestrator["🔄 Orchestrator Agent<br/>Breaks task into steps, delegates to workers,<br/>retrieves documents from RAG &amp; Memory as needed,<br/>evaluates results, loops until complete"]',
    '    end',
    '',
    '    subgraph TOOLS["🔧 Tools & Connectors — AI can DO things"]',
    '      mcp["🔌 MCP Tools<br/>Files · Database · Web Search"]',
    '      apps["🔗 App Connectors<br/>Ephorm · CaseWare · OpusChart"]',
    '    end',
    '',
    '    subgraph GPU["🖥️ Local GPU Server — YOUR HARDWARE"]',
    '      llm["🤖 OPEN-SOURCE LLM<br/>' + esc(localP.name) + '<br/>VRAM: ' + esc(localP.vram) + '<br/>Speed: ~' + localP.tokensPerSec + ' tok/s"]',
    '      gpu_info["⚡ Powered by: ' + esc(localP.hardware || localP.vram) + '<br/>One-time cost: ' + esc(localP.firstCost || fmtCurrency(localP.gpuCost)) + '<br/>Electricity: ' + esc(localP.usageCost || '~$50/mo') + '"]',
    '    end',
    '',
    '    response["📤 AI Response<br/>Answer with source citations"]',
    '    review["👤 Human Review & Approve<br/>You decide before any action"]',
    '    action["⚡ Execute Action<br/>Filed · Sent · Logged · Auditable"]',
    '',
    '    user --> prompt_combined',
    '    prompt_combined --> orchestrator',
    '    orchestrator --> mcp & apps',
    '    mcp & apps --> llm',
    '    orchestrator --> llm',
    '    prompt_combined -.-> llm',
    '    llm --> response',
    '    response --> review --> action',
    '    gpu_info -.- llm',
    '  end',
    '',
    '  %% Styling',
    '  class user userIn',
    '  class prompt_combined prompt',
    '  class orchestrator prompt',
    '  class mcp,apps tools',
    '  class llm localLLM',
    '  class gpu_info hardware',
    '  class response,review,action output',
    '',
    '  click user onDiagramNodeClick',
    '  click prompt_combined onDiagramNodeClick',
    '  click orchestrator onDiagramNodeClick',
    '  click mcp onDiagramNodeClick',
    '  click apps onDiagramNodeClick',
    '  click llm onDiagramNodeClick',
    '  click gpu_info onDiagramNodeClick',
    '  click response onDiagramNodeClick',
    '  click review onDiagramNodeClick',
    '  click action onDiagramNodeClick'
  ].join('\n');

  container.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px">⏳ Rendering local LLM flow…</div>';
  var diagId = 'loc' + Date.now();
  mermaid.render(diagId, diagramDef).then(function(result) {
    container.innerHTML = result.svg;
    if (result.bindFunctions) result.bindFunctions(container);
    if (STATE.selectedComponent) refreshLocalCloudDetailPanel();
  }).catch(function(err) {
    console.error('Mermaid local flow error:', err);
    container.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px">⚠️ Diagram render error: ' + esc(String(err.message || err)) + '</div>';
  });
}

// ═══════════════════════════════════ CLOUD API FLOW DIAGRAM ════════════════════════
function renderCloudFlowDiagram() {
  var container = document.getElementById('arch-diagram-svg');
  if (!container) return;
  if (!window.mermaid) {
    container.innerHTML = '<div class="ai-empty" style="padding:40px;text-align:center">⏳ Loading Mermaid…</div>';
    return;
  }

  var cloudP = (PRICING.cloud[STATE.cloudProvider]||{})[STATE.cloudModelTier] || null;
  var cloudName = cloudP ? cloudP.name : 'Cloud LLM API';

  var diagramDef = [
    'flowchart TB',
    '  classDef userIn    fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3',
    '  classDef prompt    fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f',
    '  classDef tools     fill:#e0f2fe,stroke:#0891b2,stroke-width:2px,color:#164e63',
    '  classDef cloudAPI  fill:#7c3aed,stroke:#5b21b6,stroke-width:3px,color:#fff',
    '  classDef internet  fill:#fee2e2,stroke:#ef4444,stroke-width:2px,stroke-dasharray:6 3,color:#991b1b',
    '  classDef output    fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d',
    '  classDef yourNet   fill:#f8fafc,stroke:#6366f1,stroke-width:2px,color:#3730a3',
    '',
    '  subgraph YOUR_NET["🏠 YOUR NETWORK — Prompt assembly, RAG, Memory &amp; Tools stay local"]',
    '    direction TB',
    '',
    '    user["👤 User Query<br/>Natural language request"]',
    '',
    '    subgraph PROMPT["📦 Prompt Assembly — ALL context combined here<br/>System Prompt + RAG (your docs) + Memory (past conversations) + User Input"]',
    '      prompt_combined["⚙️ Assembled Prompt<br/>The AI receives ONE complete, structured input<br/>containing everything it needs to answer accurately"]',
    '    end',
    '',
    '    subgraph AGENT["🧠 Agent Orchestrator — Plans → Delegates → Evaluates → Loops"]',
    '      orchestrator["🔄 Orchestrator Agent<br/>Breaks task into steps, delegates to workers,<br/>retrieves documents from RAG &amp; Memory as needed"]',
    '    end',
    '',
    '    subgraph TOOLS["🔧 Tools & Connectors (local)"]',
    '      mcp["🔌 MCP Tools<br/>Files · Database · Web Search"]',
    '      apps["🔗 App Connectors<br/>Ephorm · CaseWare · OpusChart"]',
    '    end',
    '',
    '    user --> prompt_combined',
    '    prompt_combined --> orchestrator',
    '    orchestrator --> mcp & apps',
    '    mcp & apps -.-> orchestrator',
    '  end',
    '',
    '  INTERNET["🌐 INTERNET — Encrypted HTTPS (TLS 1.3)<br/>⚠️ The assembled prompt leaves your network<br/>✅ SOC 2 / ISO 27001 compliant providers available"]',
    '',
    '  subgraph CLOUD["☁️ CLOUD AI PROVIDER — ' + esc(STATE.cloudProvider.toUpperCase()) + '"]',
    '    llm["🤖 CLOUD LLM API<br/>' + esc(cloudName) + '<br/>Pay-per-use · Always latest model<br/>Zero hardware · Auto-scaling"]',
    '    pricing["💰 ' + esc(STATE.cloudProvider.toUpperCase()) + ' Pricing<br/>$' + (cloudP?cloudP.input:'—') + '/$' + (cloudP?cloudP.output:'—') + ' per M tokens (in/out)<br/>Est. monthly: ' + fmtCurrency(calcCosts().cloudCost) + ' at current usage"]',
    '  end',
    '',
    '  response["📤 AI Response<br/>Answer with source citations — returned to your network"]',
    '  review["👤 Human Review & Approve"]',
    '  action["⚡ Execute Action<br/>Logged · Auditable"]',
    '',
    '  orchestrator --> INTERNET',
    '  INTERNET --> llm',
    '  llm --> INTERNET',
    '  INTERNET --> response',
    '  prompt_combined -.-> INTERNET',
    '  response --> review --> action',
    '  pricing -.- llm',
    '',
    '  %% Styling',
    '  class user userIn',
    '  class prompt_combined prompt',
    '  class orchestrator prompt',
    '  class mcp,apps tools',
    '  class llm cloudAPI',
    '  class pricing cloudAPI',
    '  class INTERNET internet',
    '  class response,review,action output',
    '',
    '  click user onDiagramNodeClick',
    '  click prompt_combined onDiagramNodeClick',
    '  click orchestrator onDiagramNodeClick',
    '  click mcp onDiagramNodeClick',
    '  click apps onDiagramNodeClick',
    '  click INTERNET onDiagramNodeClick',
    '  click llm onDiagramNodeClick',
    '  click pricing onDiagramNodeClick',
    '  click response onDiagramNodeClick',
    '  click review onDiagramNodeClick',
    '  click action onDiagramNodeClick'
  ].join('\n');

  container.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px">⏳ Rendering cloud API flow…</div>';
  var diagId = 'cld' + Date.now();
  mermaid.render(diagId, diagramDef).then(function(result) {
    container.innerHTML = result.svg;
    if (result.bindFunctions) result.bindFunctions(container);
    if (STATE.selectedComponent) refreshLocalCloudDetailPanel();
  }).catch(function(err) {
    console.error('Mermaid cloud flow error:', err);
    container.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px">⚠️ Diagram render error: ' + esc(String(err.message || err)) + '</div>';
  });
}

// ── Flow label updater for diagram mode switches ─────────────────────────────
function updateFlowLabel() {
  var el = document.getElementById('arch-diagram-title');
  if (!el) return;
  var labels = {
    dataflow: '🔀 Data Flow — Full Architecture',
    agentic: '🔄 Agentic Workflow — Orchestrator-Workers Pattern',
    assembly: '📝 Prompt Assembly — How the AI Receives Context',
    localFlow: '🏠 Local LLM Flow — On-Premises, Your Hardware',
    cloudFlow: '☁️ Cloud API Flow — Pay-per-Use, Zero Hardware'
  };
  el.textContent = labels[STATE.diagramMode] || labels.dataflow;
}

// ── Detail panel for Local/Cloud flow diagrams ───────────────────────────────
function refreshLocalCloudDetailPanel() {
  var compId = STATE.selectedComponent;
  var panel = document.getElementById('arch-side-panel');
  var titleEl = document.getElementById('arch-side-title');
  var bodyEl = document.getElementById('arch-side-body');
  var placeholderEl = document.getElementById('arch-side-placeholder');
  if (!panel) return;

  if (!compId) {
    panel.classList.remove('open');
    if (placeholderEl) placeholderEl.style.display = '';
    return;
  }

  panel.classList.add('open');
  if (placeholderEl) placeholderEl.style.display = 'none';

  var localP = PRICING.local[STATE.localModel] || PRICING.local['deepseek-v4-pro'];
  var cloudP = (PRICING.cloud[STATE.cloudProvider]||{})[STATE.cloudModelTier] || null;
  var costs = calcCosts();
  var isLocal = STATE.diagramMode === 'localFlow';
  var breakEvenMonths = localP.gpuCost > 0 && costs.cloudCost > costs.localCost ? Math.round(localP.gpuCost / (costs.cloudCost - costs.localCost)) : null;

  // Build a rich hardware options list for the side panel
  var hwOptionsHtml = '';
  var allLocalModels = PRICING.local;
  var modelKeys = Object.keys(allLocalModels);
  for (var mk = 0; mk < modelKeys.length; mk++) {
    var m = allLocalModels[modelKeys[mk]];
    var isCurrent = STATE.localModel === modelKeys[mk];
    hwOptionsHtml += '<div style="padding:6px 0;border-bottom:1px solid var(--ai-border-light);' + (isCurrent?'background:var(--ai-primary-bg);border-radius:4px;padding:6px;':'') + '">' +
      '<strong>' + (isCurrent?'✅ ':'') + esc(m.name) + '</strong><br>' +
      '<span style="font-size:11px;color:var(--ai-text-secondary)">🖥️ ' + esc(m.hardware || m.vram) + '</span><br>' +
      '<span style="font-size:11px;color:var(--ai-text-secondary)">💰 Upfront: ' + esc(m.firstCost || fmtCurrency(m.gpuCost)) + ' · ⚡ ' + esc(m.usageCost || '~$50/mo') + ' · 🚀 ' + m.tokensPerSec + ' tok/s</span>' +
      '</div>';
  }

  var info = {
    'user': { title:'👤 User Query', desc:'The user states their goal in natural language — exactly like talking to a colleague.', config:'This is the starting point. Everything else adds context around this question.' },
    'prompt_combined': { title:'📦 Prompt Assembly — ALL Context Combined', desc:'System Prompt (rules & tone) + RAG (your documents) + Memory (past conversations) + User Input are merged into ONE structured prompt. The LLM receives this single, complete input.', config:'<strong>Without proper prompt assembly:</strong> the AI gives generic answers.<br><strong>With it:</strong> every response is grounded in YOUR data, YOUR rules, and YOUR context. This is the #1 reason enterprise AI outperforms generic chatbots.' },
    'orchestrator': { title:'🧠 Orchestrator Agent', desc:'The central controller: plans steps, delegates to specialized workers, retrieves documents from RAG & Memory as needed, monitors progress, and loops until the task is complete.', config:'<strong>Anthropic\'s recommended pattern</strong> for complex tasks. Single agents fail on multi-step work — the orchestrator pattern handles it reliably. Think: project manager for AI agents.' },
    'mcp': { title:'🔌 MCP Tools — What the AI Can DO', desc:'The AI\'s "hands" — file system access, database queries, web search. Standardized via Anthropic\'s Model Context Protocol (MCP). Currently enabled: <strong>' + STATE.mcpTools.join(', ') + '</strong>.', config:'<strong>More tools = more capability</strong> but larger security surface and higher cost (~$5/mo per tool). Enable only what each use case actually needs.' },
    'apps': { title:'🔗 App Connectors — Links to YOUR Business Apps', desc:'Domain-specific bridges: <strong>' + STATE.appConnectors.join(', ') + '</strong>. Each exposes a standardized API that the orchestrator discovers and calls automatically.', config:'<strong>No vendor lock-in:</strong> standardized interfaces. The orchestrator discovers tools dynamically. Add new apps without rebuilding the AI system.' },
    'llm': { title: isLocal ? '🤖 Open-Source LLM — Running on YOUR Hardware' : '🤖 Cloud LLM — API-Powered',
      desc: isLocal
        ? '<strong>' + esc(localP.name) + '</strong><br>🖥️ VRAM: ' + esc(localP.vram) + '<br>⚡ Speed: ~' + localP.tokensPerSec + ' tokens/sec<br>🔒 100% data sovereignty — nothing leaves your network'
        : '<strong>' + esc(cloudP?cloudP.name:'Cloud LLM API') + '</strong><br>☁️ Provider: ' + esc(STATE.cloudProvider.toUpperCase()) + '<br>📊 Tier: ' + esc(STATE.cloudModelTier) + '<br>🔄 Always latest model · Auto-scaling',
      config: isLocal
        ? '<strong>💰 Hardware Cost Breakdown:</strong><br>🖥️ GPU: ' + esc(localP.hardware || localP.vram) + '<br>💵 One-time purchase: <strong>' + esc(localP.firstCost || fmtCurrency(localP.gpuCost)) + '</strong><br>⚡ Monthly electricity: ' + esc(localP.usageCost || '~$50/mo') + '<br>🔧 Monthly maintenance: ~$200<br>📊 Amortized monthly: ' + fmtCurrency(localP.gpuCost/36) + ' (over 3 years)<br>⏱️ Break-even vs cloud: <strong>' + (breakEvenMonths ? breakEvenMonths + ' months' : 'Varies by usage') + '</strong><br><br><em>' + esc(localP.notes || '') + '</em>'
        : '<strong>💰 Pricing Details:</strong><br>📥 Input: $' + (cloudP?cloudP.input:'—') + ' / M tokens<br>📤 Output: $' + (cloudP?cloudP.output:'—') + ' / M tokens<br>💵 Est. monthly: <strong>' + fmtCurrency(costs.cloudCost) + '</strong> at current usage (' + fmtNum(STATE.dau) + ' DAU)<br>📊 Per-query avg: ~$' + ((cloudP?(cloudP.input*0.6+cloudP.output*0.4)*STATE.avgTokens/1000:0)).toFixed(4) + '<br>🔄 No upfront · Pay only for what you use'
    },
    'gpu_info': { title:'🖥️ GPU Server — Hardware Options & Costs',
      desc:'The physical GPU running the open-source LLM on-premises. Current selection: <strong>' + esc(localP.name) + '</strong>.',
      config:'<strong>🔧 Available Hardware Options:</strong><br>' + hwOptionsHtml + '<br><span style="font-size:10px;color:var(--ai-text-muted)">💡 Change model in ⚙️ Configure tab → Local Model dropdown. Hardware costs update automatically.</span>'
    },
    'pricing': { title:'💰 Cloud API Pricing — Full Breakdown',
      desc:'<strong>' + esc(STATE.cloudProvider.toUpperCase()) + '</strong> · ' + esc(STATE.cloudModelTier.toUpperCase()) + ' tier · ' + esc(cloudP?cloudP.name:'Custom'),
      config:'<strong>📊 Pricing per Million Tokens:</strong><br>📥 Input: <strong>$' + (cloudP?cloudP.input:'—') + '</strong> / M tokens<br>📤 Output: <strong>$' + (cloudP?cloudP.output:'—') + '</strong> / M tokens<br><br><strong>💵 Your Estimated Costs:</strong><br>📊 Monthly queries: ' + fmtNum(costs.monthlyQueries) + '<br>📝 Total tokens/month: ' + fmtNum(costs.totalTokensPerMonth) + '<br>💰 Cloud LLM cost: <strong>' + fmtCurrency(costs.cloudCost) + '/mo</strong><br>📊 Per-query avg: ~$' + ((cloudP?(cloudP.input*0.6+cloudP.output*0.4)*STATE.avgTokens/1000:0)).toFixed(4) + '<br><br><span style="font-size:10px;color:var(--ai-text-muted)">💡 Change provider or tier in ⚙️ Configure tab to compare costs.</span>'
    },
    'INTERNET': { title:'🌐 Internet (HTTPS — Encrypted)', desc:'Data is encrypted in transit using TLS 1.3. Only the assembled prompt leaves your network — your documents, memory, and apps stay local.', config:'<strong>⚠️ Privacy Consideration:</strong> The prompt content is processed on the cloud provider\'s servers. For sensitive audit data, use the <strong>Local LLM</strong> option instead. For general queries, major providers are SOC 2 / ISO 27001 compliant.' },
    'response': { title:'📤 AI Response', desc:'The AI\'s answer — with source citations from RAG so you can verify accuracy.', config:'The deliverable. Accurate (RAG), personalized (Memory), professional (System Prompt). Users can click citations to see the original source document.' },
    'review': { title:'👤 Human Review & Approve', desc:'A human reviews the AI\'s output and approves the proposed ACTION before anything happens.', config:'<strong>Non-negotiable for enterprise AI.</strong> Every consequential action (file, send, update) needs human approval. Every approval is logged for audit.' },
    'action': { title:'⚡ Execute Action', desc:'Once approved by a human, the system executes: files a document, sends an email, updates a record, triggers a workflow.', config:'Every action is <strong>logged, attributable, and reversible</strong> — SOC 2 / ISO 27001 compliant. Full audit trail for regulatory review.' }
  };

  var entry = info[compId];
  if (entry && titleEl) titleEl.textContent = entry.title;
  if (bodyEl && entry) {
    bodyEl.innerHTML =
      '<div class="ai-detail-block"><div class="ai-detail-block-title">📋 What it does</div><div class="ai-detail-block-desc">' + esc(entry.desc) + '</div></div>' +
      '<div class="ai-detail-block" style="background:var(--ai-success-bg);border-left:3px solid var(--ai-success)"><div class="ai-detail-block-title">💡 Why it matters</div><div class="ai-detail-block-desc">' + esc(entry.config) + '</div></div>' +
      '<button class="ai-btn ai-btn-sm ai-btn-outline" onclick="selectArchComponent(null)" style="margin-top:8px;width:100%">✕ Close Panel</button>';
  }
}

function refreshAssemblyDetailPanel() {
  var compId = STATE.selectedComponent;
  var panel = document.getElementById('arch-side-panel');
  var titleEl = document.getElementById('arch-side-title');
  var bodyEl = document.getElementById('arch-side-body');
  var placeholderEl = document.getElementById('arch-side-placeholder');
  if (!panel) return;

  if (!compId) {
    panel.classList.remove('open');
    if (placeholderEl) placeholderEl.style.display = '';
    return;
  }

  panel.classList.add('open');
  if (placeholderEl) placeholderEl.style.display = 'none';

  var labels = {
    'asm-user':     { title:'👤 User Input', desc:'This is the question or task the user types — exactly like sending a message to a colleague. It could be "Draft an audit memo" or "Find all clients with pending reviews."', config:'This is the starting point. Everything else is context added AROUND the user\'s question to help the AI answer it accurately.' },
    'asm-system':    { title:'📋 System Prompt', desc:'The AI\'s permanent instructions — its job description. It tells the AI: who you are, what company you work for, how to behave, what tone to use, what rules to follow, and what kind of answers are expected.', config:'Without a system prompt, the AI would give generic answers. The system prompt makes every response feel like it came from someone who understands your business.' },
    'asm-rag':       { title:'📚 RAG Pipeline (Lewis et al., 2020)', desc:'The industry-standard Retrieval-Augmented Generation pipeline. Documents → Chunking → Embedding → Vector Store. At query time: User Question → Embed → Retrieve Top-K → Re-rank → Augment Prompt → Generate Response.', config:'RAG is what makes enterprise AI trustworthy. Instead of the AI guessing, it retrieves the actual policy, standard, or document and cites it. Modern RAG adds re-ranking (selecting the best chunks) and hybrid search (keyword + semantic). This is the foundation of accurate enterprise AI.' },
    'asm-memory':    { title:'🧠 Memory Context', desc:'The system recalls past conversations, user preferences, and facts it has learned. "This user prefers bullet points," "We discussed this client last week," "The company standard is X."', config:'Memory makes interactions feel continuous and personal. Without it, every conversation would start from scratch. With it, the AI remembers what matters.' },
    'asm-combined':  { title:'📦 Combined Prompt', desc:'All four sources — System Prompt, Memory, RAG Knowledge, and User Input — are merged into a single, structured text. This is what gets sent to the AI model.', config:'The AI does not know which piece came from where. It sees one complete prompt. The assembly order matters: System Prompt first (sets the rules), then Memory & RAG (add context), then User Input (the actual question).' },
    'asm-llm':       { title:'🧠 LLM (AI Model)', desc:'The AI model processes the combined prompt and generates a response. This is the "thinking" step — the model predicts the most helpful and accurate answer based on everything it received.', config:'The LLM is the engine. It can run on your own hardware (on-prem) or in the cloud (API). The prompt assembly is the same either way — what changes is where the processing happens.' },
    'asm-response':  { title:'📤 Final Response', desc:'The AI\'s answer is returned to the user. It can be plain text, a formatted document, a table, or a recommendation. Citations show which RAG documents were used so the user can verify accuracy.', config:'The response is the deliverable. A good response is accurate (thanks to RAG), personalized (thanks to Memory), professional (thanks to System Prompt), and directly answers the question (User Input).' }
  };

  var info = labels[compId];
  if (info && titleEl) titleEl.textContent = info.title;
  if (bodyEl && info) {
    bodyEl.innerHTML =
      '<div class="ai-detail-block"><div class="ai-detail-block-title">📋 What it does</div><div class="ai-detail-block-desc">' + esc(info.desc) + '</div></div>' +
      '<div class="ai-detail-block" style="background:var(--ai-success-bg);border-left:3px solid var(--ai-success)"><div class="ai-detail-block-title">💡 Why it matters</div><div class="ai-detail-block-desc">' + esc(info.config) + '</div></div>' +
      '<button class="ai-btn ai-btn-sm ai-btn-outline" onclick="selectArchComponent(null)" style="margin-top:8px;width:100%">✕ Close Panel</button>';
  }
}

function refreshAgentDetailPanel() {
  var compId = STATE.selectedComponent;
  var panel = document.getElementById('arch-side-panel');
  var titleEl = document.getElementById('arch-side-title');
  var bodyEl = document.getElementById('arch-side-body');
  var placeholderEl = document.getElementById('arch-side-placeholder');
  if (!panel) return;

  if (!compId) {
    panel.classList.remove('open');
    if (placeholderEl) placeholderEl.style.display = '';
    return;
  }

  panel.classList.add('open');
  if (placeholderEl) placeholderEl.style.display = 'none';

  // Look up in agentic components first, then data flow components
  var agentLabels = {
    'agent-user':     { title:'👤 User Prompt', desc:'The user provides a high-level task or goal. The orchestrator interprets this and creates an execution plan.', config:'Task: User-defined | Priority: Normal | Context from memory attached' },
    'agent-orch':     { title:'🧠 Orchestrator Agent', desc:'The central controller. Decomposes the task into sub-tasks, assigns them to specialized agents, monitors progress, evaluates results, and decides when the task is complete.', config:'Pattern: Plan → Execute → Evaluate → Repeat | Max iterations: configurable | Sub-agents: Doer, Reviewer, Tools, Manager' },
    'agent-doer':     { title:'👤 Doer Agent', desc:'Executes assigned sub-tasks: drafts documents, runs database queries, extracts data, generates reports. Reports results back to the orchestrator.', config:'Agent Persona: ' + STATE.agentPersona + ' | Tools: MCP file system, database | Output: Structured data' },
    'agent-reviewer': { title:'🔍 Reviewer Agent', desc:'Reviews Doer output against policies, quality standards, and rules. Flags anomalies, requests corrections, or approves for next step.', config:'Standards: PKF audit guidelines | Checks: Accuracy, completeness, compliance | Escalation: To Manager Agent' },
    'agent-tools':    { title:'🔧 Tool / MCP Agent', desc:'Interfaces with external systems via MCP and APIs: searches knowledge bases, queries databases, reads files, calls SaaS APIs.', config:'MCP Tools: ' + STATE.mcpTools.join(', ') + ' | App Connectors: ' + STATE.appConnectors.join(', ') },
    'agent-manager':  { title:'👔 Manager Agent', desc:'Makes high-level decisions, approves final outputs, handles escalations from Reviewer. Can request human intervention if confidence is low.', config:'Decision threshold: configurable | Human escalation: on low confidence | Final approval: routed to User Review' },
    'agent-memory':   { title:'🧠 Memory & RAG (Shared Context)', desc:'All agents share the same memory and RAG context. This ensures consistency — the Doer and Reviewer see the same company policies and user history.', config:'Memory Strategy: ' + STATE.memoryStrategy + ' | RAG: ' + STATE.ragEnabled + ' | Backend: ' + STATE.memoryBackend },
    'agent-loop':     { title:'🔄 Loop Control', desc:'The orchestrator evaluates after each sub-task: Is the overall goal achieved? If yes → proceed to Response. If no → assign next sub-task. This continues until complete or max iterations reached.', config:'Max Iterations: configurable | Timeout: configurable | Loop detection: prevents infinite loops' },
    'agent-response': { title:'📤 Final Response', desc:'The completed AI output is presented to the user for review. This could be a draft document, analysis report, data extraction, or recommendation.', config:'Format: Streaming text, structured JSON, or file | Citations from RAG attached' },
    'agent-approval': { title:'👤 User Review & Approval', desc:'The human user reviews the AI output and approves (or rejects) the proposed ACTION. This is NOT approving the response text — it\'s approving what the system should DO.', config:'Options: Approve / Reject / Modify | Audit trail: Full | Role-based: Senior/Manager approval' },
    'agent-action':   { title:'⚡ Execute Action', desc:'Once approved by the user, the system executes the action: files a document, sends an email, updates a database record, triggers a workflow, or calls an external API.', config:'Action types: File, Send, Update, Trigger, API Call | Retry: 3 attempts | Rollback: Supported' }
  };

  var info = agentLabels[compId];
  if (!info) {
    // Fall back to data flow component lookup
    var comp = findComp(COMPONENTS, compId);
    if (comp) {
      info = { title: comp.label, desc: comp.desc, config: getComponentConfig(compId) };
    }
  }

  if (info && titleEl) titleEl.textContent = info.title;
  if (bodyEl && info) {
    bodyEl.innerHTML =
      '<div class="ai-detail-block"><div class="ai-detail-block-title">📋 What it does</div><div class="ai-detail-block-desc">' + esc(info.desc) + '</div></div>' +
      '<div class="ai-detail-block" style="background:var(--ai-success-bg);border-left:3px solid var(--ai-success)"><div class="ai-detail-block-title">💡 Why it matters</div><div class="ai-detail-block-desc">' + esc(info.config) + '</div></div>' +
      '<button class="ai-btn ai-btn-sm ai-btn-outline" onclick="selectArchComponent(null)" style="margin-top:8px;width:100%">✕ Close Panel</button>';
  }
}

function drawStraightArrow(svg, x1, y1, x2, y2, color, width, dashed) {
  var dash = dashed ? ' stroke-dasharray="4,3"' : '';
  return svg + '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + (y2-4) + '" stroke="' + color + '" stroke-width="' + width + '"' + dash + ' marker-end="url(#arrowhead)"/>';
}

function findCompPos(comps, id) { for (var i=0;i<comps.length;i++) { if (comps[i].id===id) return comps[i]; } return null; }

function findComp(comps, id) { for (var i=0;i<comps.length;i++) { if (comps[i].id===id) return comps[i]; } return null; }

function selectArchComponent(compId) {
  STATE.selectedComponent = compId;
  renderArchitectureDiagram();
  if (STATE.diagramMode === 'agentic') refreshAgentDetailPanel();
  else if (STATE.diagramMode === 'assembly') refreshAssemblyDetailPanel();
  else if (STATE.diagramMode === 'localFlow' || STATE.diagramMode === 'cloudFlow') refreshLocalCloudDetailPanel();
  else refreshDetailPanel();
}

function refreshDetailPanel() {
  var compId = STATE.selectedComponent;
  var comp = findComp(COMPONENTS, compId);
  var panel = document.getElementById('arch-side-panel');
  var titleEl = document.getElementById('arch-side-title');
  var bodyEl = document.getElementById('arch-side-body');
  var placeholderEl = document.getElementById('arch-side-placeholder');

  if (!panel) return;

  if (!compId || !comp) {
    panel.classList.remove('open');
    if (placeholderEl) placeholderEl.style.display = '';
    return;
  }

  panel.classList.add('open');
  if (placeholderEl) placeholderEl.style.display = 'none';
  if (titleEl) titleEl.textContent = comp.label;
  if (bodyEl) {
    var config = getComponentConfig(compId);
    bodyEl.innerHTML =
      '<div class="ai-detail-block"><div class="ai-detail-block-title">📋 What it does</div><div class="ai-detail-block-desc">' + esc(comp.desc) + '</div></div>' +
      '<div class="ai-detail-block" style="background:var(--ai-success-bg);border-left:3px solid var(--ai-success)"><div class="ai-detail-block-title">💡 Why it matters</div><div class="ai-detail-block-desc">' + esc(config) + '</div></div>' +
      '<button class="ai-btn ai-btn-sm ai-btn-outline" onclick="selectArchComponent(null)" style="margin-top:8px;width:100%">✕ Close Panel</button>';
  }
}

function getComponentConfig(compId) {
  var explanations = {
    'user-prompt': '<strong>🔧 How it works:</strong> The user types a question or task in plain language — exactly like telling a colleague what to do. No special commands or syntax needed.<br><br><strong>💡 Example:</strong> "Draft an audit memo for client XYZ covering the 2025 fiscal year findings" or "Find all clients with pending tax reviews due this month."',
    'agent-workflow': '<strong>⚠️ This is PURE REGULAR CODE — NOT an LLM call.</strong> The Orchestrator is a Python/TypeScript state machine (LangGraph). It uses deterministic logic: if/then/else, loops, state transitions. It calls the LLM only when text needs to be generated or analyzed.<br><br><strong>🔧 How it works:</strong> 1) Receives the user goal 2) Breaks it into sub-tasks 3) Delegates each to specialized worker agents 4) Evaluates results 5) Loops until complete. Think: project manager for AI.<br><br><strong>💡 Example:</strong> User asks "Prepare Q4 audit report." Orchestrator: Step 1 -> Doer drafts the report. Step 2 -> Reviewer checks against standards. Step 3 -> Not done? Plan next step. Step 4 -> Manager approves final output.',
    'copilot': '<strong>🔧 How it works:</strong> Microsoft AI platform built into M365 (Teams, Word, Excel, Outlook). Connects to your organization data via Microsoft Graph API. Can be extended with Copilot Studio for custom agents.<br><br><strong>💡 Example:</strong> In Teams, type "Summarize the email thread with client ABC" — Copilot reads your emails and summarizes. Or in Word: "Draft an audit response letter using the PKF template."',
    'system-prompt': '<strong>🔧 How it works:</strong> The System Prompt is the AI permanent instruction set — its "job description." It defines: role (who you are), tone (professional/casual), rules (compliance boundaries), and expected output format. This text is prepended to EVERY query.<br><br><strong>💡 Example:</strong> "You are an audit assistant for PKF. Always cite relevant IFRS/ISA standards. Be precise and professional. Never disclose client names outside the firm. If unsure, say so and suggest consulting a senior auditor."',
    'rag': '<strong>🔧 How it works:</strong> RAG = Retrieval-Augmented Generation (Lewis et al., 2020). 1) Your documents are split into chunks 2) Each chunk is converted to a vector (embedding) 3) At query time, the user question is also vectorized 4) The most similar document chunks are retrieved 5) These chunks are added to the prompt as context 6) The LLM generates an answer citing those documents.<br><br><strong>💡 Example:</strong> User asks "What is PKF policy on client data retention?" -> RAG retrieves the exact policy document -> LLM answers with citations to the policy.',
    'user-memory': '<strong>🔧 How it works:</strong> Stores your conversation history, preferences, and learned facts. The AI remembers: "This auditor prefers bullet-point summaries," "We discussed client XYZ last Tuesday," "User always asks for IFRS references."<br><br><strong>💡 Example:</strong> You: "Remember that audit issue from last week?" AI: "Yes — the revenue recognition timing concern for client DEF. Would you like me to pull up the relevant IFRS 15 guidance?"',
    'company-memory': '<strong>🔧 How it works:</strong> Shared organizational knowledge: PKF policies, brand guidelines, standard templates, approved methodologies. Every employee AI assistant references the same company memory.<br><br><strong>💡 Example:</strong> Any auditor asking "What is the standard engagement letter template?" gets the exact same, company-approved template — not a hallucinated version.',
    'app-memory': '<strong>🔧 How it works:</strong> Each application (Ephorm Audit, Ephorm Tax, CaseWare) maintains its own isolated context. This prevents audit data from mixing with tax data — critical for compliance.<br><br><strong>💡 Example:</strong> The AI in Ephorm Audit knows your audit workpapers. The AI in Ephorm Tax knows your tax filings. They do not cross-contaminate. Regulatory requirement — not optional.',
    'external-memory': '<strong>🔧 How it works:</strong> A unified memory layer (Redis/Mem0) that ALL applications share. Start a task in the web app, continue in VS Code, finish in Teams — the AI remembers everything across all platforms.<br><br><strong>💡 Example:</strong> You search for a client document on the web portal. Later, you open VS Code and ask "What was that document I found earlier?" — the AI remembers because all apps share the same memory.',
    'app-connectors': '<strong>🔧 How it works:</strong> Domain-specific bridges to your existing business tools (Ephorm Audit, Ephorm Tax, CaseWare, OpusChart). Each connector exposes a standardized API that the AI orchestrator discovers and uses automatically.<br><br><strong>💡 Example:</strong> The AI orchestrator needs client financial data -> calls the Ephorm Audit connector -> retrieves the data -> passes it to the LLM for analysis.',
    'api-mcp': '<strong>🔧 How it works:</strong> MCP (Model Context Protocol) is Anthropic open standard — the AI "hands." Tools include: file system (read/write), database queries, web search, email, calendar. The AI discovers available tools and calls them as needed.<br><br><strong>💡 Example:</strong> AI: "I need to check the client last filing date." -> Calls the Database MCP tool -> Queries the filing system -> Gets the date -> Incorporates it into the response.',
    'training': '<strong>🔧 How it works:</strong> The customization spectrum: Prompt Engineering (fastest, free) -> RAG (adds document knowledge) -> Fine-Tuning (deepest, most expensive). Fine-tuning retrains the model on domain-specific examples — like teaching it PKF audit terminology.<br><br><strong>💡 Example:</strong> Fine-tune a model on 5,000 PKF audit reports so it naturally uses PKF terminology and understands audit-specific jargon without being told each time.',
    'llm-local': '<strong>🔧 How it works:</strong> The LLM runs on YOUR GPU hardware — nothing leaves your network. You download an open-source model (DeepSeek V4 Pro, Llama 4, Qwen 3), load it into Ollama or vLLM, and call it like a local API. Full data sovereignty.<br><br><strong>💡 Example:</strong> Running DeepSeek V4 Pro on a Dual RTX 5090 workstation. Client audit data is processed 100% on-premises. No internet connection needed after model download.',
    'llm-cloud': '<strong>🔧 How it works:</strong> Your prompt is sent via encrypted HTTPS to a cloud provider (OpenAI, Anthropic, Google). The provider massive GPU cluster processes it and returns the response. You pay per token — zero hardware to manage.<br><br><strong>💡 Example:</strong> Send "Analyze this 50-page contract" to Claude Opus 4.8. The prompt + document is ~100K tokens. Cost: ~$0.09 input + ~$0.45 output = ~$0.54 total. Response time: ~5 seconds.',
    'llm-hybrid': '<strong>🔧 How it works:</strong> A smart router classifies each query: sensitive data? -> route to local LLM. General query? -> route to cloud API. Cost optimization: high-volume simple queries go local, complex reasoning goes cloud.<br><br><strong>💡 Example:</strong> Query containing client name "ABC Corp"? -> Auto-routed to on-prem LLM (privacy). Query asking "What is IFRS 16?" -> Routed to cloud (public knowledge, faster).',
    'review-approval': '<strong>⚠️ NON-NEGOTIABLE for enterprise AI.</strong> Before the AI takes any real action (file a document, send an email, update a record), a human MUST review and approve. The AI proposes — the human decides.<br><br><strong>💡 Example:</strong> AI: "I have drafted the audit response letter for client XYZ. It addresses all 5 findings with references to ISA 315 and ISA 330. [SHOW DRAFT] -> Approve sending?" Human reviews -> Clicks Approve -> AI sends.',
    'action': '<strong>🔧 How it works:</strong> Once a human approves, the system executes: files the document in the DMS, sends the email via Outlook, updates the database record, triggers the next workflow step. Every action is logged with: who approved it, when, what exactly was done.<br><br><strong>💡 Example:</strong> Action log entry: "2026-06-26 14:32 | User: Jane Smith | Action: Filed audit_report_Q4_2025.pdf to client XYZ folder | Approval ID: #45892 | Reversible: Yes"',
    'response': '<strong>🔧 How it works:</strong> The AI generates its answer based on the combined prompt (System Prompt + RAG + Memory + User Input). The response includes source citations so users can verify accuracy by checking the original documents.<br><br><strong>💡 Example:</strong> AI response: "Based on PKF client data retention policy (Section 4.2, retrieved from RAG), client files must be retained for 7 years after engagement completion. For client XYZ, the retention period ends March 2033. [Source: PKF-POL-2024-003, paragraph 4.2]"'
  };
  return explanations[compId] || '';
}

// ═══════════════════════════════════ OPTIONS COMPARE VIEW ═══════════════════════════════════
function renderCompareView() {
  var container = document.getElementById('compare-table-container');
  if (!container) return;

  var html = '<table class="ai-compare-table"><thead><tr><th>Factor</th>';
  for (var i=0;i<OPTIONS.length;i++) { html += '<th>' + OPTIONS[i].icon + ' ' + OPTIONS[i].name + '</th>'; }
  html += '</tr></thead><tbody>';

  var rows = [
    { label: 'Setup Effort', key: 'effort', type: 'stars' },
    { label: 'Security / Privacy', key: 'security', type: 'stars' },
    { label: 'Scalability', key: 'scalability', type: 'stars' },
    { label: 'Best Fit', key: 'fit', type: 'text' }
  ];

  for (var r=0;r<rows.length;r++) {
    html += '<tr><td><strong>' + rows[r].label + '</strong></td>';
    for (var o=0;o<OPTIONS.length;o++) {
      var val = OPTIONS[o][rows[r].key];
      if (rows[r].type === 'stars') {
        var cls = val.indexOf('⭐⭐⭐⭐⭐')===0 ? 'col-best' : val.indexOf('⭐⭐⭐⭐')===0 ? 'col-good' : val.indexOf('⭐⭐⭐')===0 ? 'col-warn' : 'col-poor';
        html += '<td class="col-score ' + cls + '">' + val + '</td>';
      } else {
        html += '<td style="font-size:11px">' + esc(val) + '</td>';
      }
    }
    html += '</tr>';
  }

  html += '<tr><td><strong>👍 Pros</strong></td>';
  for (var p=0;p<OPTIONS.length;p++) { html += '<td style="font-size:11px;color:var(--ai-success)">' + esc(OPTIONS[p].pros) + '</td>'; }
  html += '</tr>';
  html += '<tr><td><strong>👎 Cons</strong></td>';
  for (var c=0;c<OPTIONS.length;c++) { html += '<td style="font-size:11px;color:var(--ai-danger)">' + esc(OPTIONS[c].cons) + '</td>'; }
  html += '</tr>';

  html += '</tbody></table>';
  container.innerHTML = html;

  // Recommendation
  var recContent = document.getElementById('compare-rec-content');
  if (recContent) {
    recContent.innerHTML = '<p>Based on PKF use cases (<strong>' + STATE.useCases.map(function(id){var uc=findUseCase(id);return uc?uc.name:id;}).join(', ') + '</strong>), pilot scope (' + STATE.pilotPhase + '), and data sensitivity requirements:</p>' +
      '<div class="ai-rec-highlight">🏆 <strong>Recommended: Hybrid Approach (Custom App + Cloud LLM + Optional On-Prem)</strong><br>' +
      'Start with Copilot Studio for M365-integrated workflows (Ephorm inside Teams/Office). Build a custom Python/FastAPI orchestrator with MCP for cross-app agent workflows (Ephorm Audit + Tax + CaseWare). Use cloud LLM for PoC speed; add on-prem LLM later for sensitive client data. External shared memory (Mem0 or Redis) connects all apps.</div>' +
      '<p><strong>Rationale:</strong> Copilot alone cannot connect deeply to Ephorm/CaseWare. Pure on-prem is too slow for PoC. Hybrid gives privacy + flexibility + speed.</p>';
  }

  // Fit matrix
  renderFitMatrix();
}

function findUseCase(id) { for (var i=0;i<USE_CASES.length;i++) { if (USE_CASES[i].id===id) return USE_CASES[i]; } return null; }

function renderFitMatrix() {
  var el = document.getElementById('fit-matrix');
  if (!el) return;

  var html = '<table class="ai-fit-table"><thead><tr><th>Use Case</th>';
  for (var o=0;o<OPTIONS.length;o++) { html += '<th>' + OPTIONS[o].icon + '</th>'; }
  html += '</tr></thead><tbody>';

  for (var u=0;u<USE_CASES.length;u++) {
    var uc = USE_CASES[u];
    var isSelected = STATE.useCases.indexOf(uc.id) !== -1;
    html += '<tr' + (isSelected ? ' style="background:var(--ai-primary-bg)"' : '') + '><td><strong>' + (isSelected ? '✅ ' : '') + esc(uc.name) + '</strong><br><span style="font-size:10px;color:var(--ai-text-muted)">' + esc(uc.desc) + '</span></td>';
    for (var o=0;o<OPTIONS.length;o++) {
      var score = FIT_SCORES[OPTIONS[o].id][uc.id] || 3;
      var cls = score >= 5 ? 'ai-fit-yes' : score >= 4 ? 'ai-fit-partial' : 'ai-fit-no';
      var label = score >= 5 ? '✓✓✓' : score >= 4 ? '✓✓' : score >= 3 ? '✓' : '—';
      html += '<td class="' + cls + '">' + label + '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

// ═══════════════════════════════════ COST & HARDWARE VIEW ═══════════════════════════════════
function renderCostView() {
  var costs = calcCosts();
  renderHardwareOptions();
  renderDeploymentComparisonTable(costs);
  renderCostCards(costs);
  renderCostChart(costs);
  renderBreakeven(costs);
  renderSoftwareStack();
}

function renderHardwareOptions() {
  var el = document.getElementById('hardware-options');
  if (!el) return;
  var html = '';
  for (var i=0;i<HARDWARE_OPTIONS.length;i++) {
    var hw = HARDWARE_OPTIONS[i];
    var isRec = (STATE.pilotPhase === 'pilot' && hw.id === 'mac-studio') || (STATE.pilotPhase === 'poc' && hw.id === 'cloud-only') || (STATE.deploymentType === 'copilot' && hw.id === 'copilot-m365');
    var isCopilotHW = hw.id === 'copilot-m365';
    html += '<div class="ai-hw-card' + (isRec ? ' recommended' : '') + '">';
    html += '<div class="ai-hw-name">' + hw.icon + ' ' + esc(hw.name) + '</div>';
    html += '<div class="ai-hw-spec">' + esc(hw.spec) + '</div>';
    html += '<div class="ai-hw-price">' + (hw.price > 0 ? fmtCurrency(hw.price) : 'No HW cost') + '</div>';
    html += '<span class="ai-hw-tag ai-hw-tag-' + hw.tag + '">' + esc(hw.bestFor) + '</span>';
    if (isRec) html += ' <span class="ai-hw-tag ai-hw-tag-pilot" style="margin-left:4px">⭐ Recommended</span>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderSoftwareStack() {
  var el = document.getElementById('software-stack');
  if (!el) return;
  var html = '';
  for (var g=0;g<SOFTWARE_STACK.length;g++) {
    var group = SOFTWARE_STACK[g];
    html += '<div style="margin-bottom:8px"><strong style="font-size:12px;color:var(--ai-text-secondary);text-transform:uppercase;letter-spacing:0.5px">📦 ' + esc(group.category) + '</strong></div>';
    for (var i=0;i<group.items.length;i++) {
      var item = group.items[i];
      html += '<div class="ai-sw-item"><div class="ai-sw-name">' + esc(item.name) + '</div><div class="ai-sw-desc">' + esc(item.desc) + '</div><div class="ai-sw-cost">💰 ' + esc(item.cost) + '</div></div>';
    }
  }
  el.innerHTML = html;
}

// ═══════════════════════════════════ DEPLOYMENT COMPARISON TABLE ═══════════════════
function renderDeploymentComparisonTable(costs) {
  var el = document.getElementById('deployment-compare-table');
  if (!el) return;

  var localP = PRICING.local[STATE.localModel] || PRICING.local['deepseek-v4-pro'];
  var cloudP = (PRICING.cloud[STATE.cloudProvider]||{})[STATE.cloudModelTier] || null;
  var tf = document.getElementById('cost-timeframe');
  var mult = tf && tf.value === 'annual' ? 12 : tf && tf.value === '3year' ? 36 : 1;
  var period = mult === 12 ? '/yr' : mult === 36 ? '/3yr' : '/mo';

  var localM = costs.localCost * mult;
  var cloudM = costs.cloudCost * mult;
  var hybridM = costs.hybridCost * mult;
  var cheapest = localM <= cloudM && localM <= hybridM ? 'local' : cloudM <= hybridM ? 'cloud' : 'hybrid';

  var rows = [
    { label:'🏷️ Model Used', local:esc(localP.name), cloud:cloudP?esc(cloudP.name):'Custom API', hybrid:'Local: ' + esc(localP.name) + ' + Cloud: ' + (cloudP?esc(cloudP.name):'API') },
    { label:'🔒 Data Privacy', local:'⭐⭐⭐⭐⭐<br><small>100% on-prem — nothing leaves</small>', cloud:'⭐⭐⭐<br><small>Data sent over HTTPS to provider</small>', hybrid:'⭐⭐⭐⭐<br><small>Sensitive data stays local, rest goes cloud</small>' },
    { label:'⚡ Latency (Response Speed)', local:'~' + (1000/localP.tokensPerSec).toFixed(1) + ' ms/tok<br><small>Depends on GPU — no network delay</small>', cloud:'~15-30 ms/tok<br><small>Fast, but adds network round-trip</small>', hybrid:'~20 ms/tok avg<br><small>Routing adds small overhead</small>' },
    { label:'🧠 Model Choice', local:'Limited to open-weight models<br><small>DeepSeek V4 Pro, Llama 4, Qwen 3, Phi-4</small>', cloud:'ALL models available<br><small>GPT-5.4, Claude Opus 4.8, Gemini 3.0, + more</small>', hybrid:'Best of both<br><small>Cloud for cutting-edge, local for privacy</small>' },
    { label:'📈 Scalability', local:'⭐⭐<br><small>Limited by your GPU — buy more hardware to scale</small>', cloud:'⭐⭐⭐⭐⭐<br><small>Auto-scaling — handles spikes instantly</small>', hybrid:'⭐⭐⭐⭐<br><small>Cloud handles spikes, local handles baseline</small>' },
    { label:'🔧 Maintenance', local:'⭐⭐⭐⭐<br><small>You manage GPU, drivers, updates, power</small>', cloud:'⭐<br><small>Zero maintenance — provider handles everything</small>', hybrid:'⭐⭐⭐<br><small>Maintain local + monitor cloud costs</small>' },
    { label:'⏱️ Setup Time', local:'2-4 weeks<br><small>Buy hardware → Install Ollama → Configure</small>', cloud:'1-3 days<br><small>Sign up → Get API key → Start coding</small>', hybrid:'3-6 weeks<br><small>Cloud first (fast), then add local</small>' },
    { label:'💰 Upfront Cost', local:fmtCurrency(localP.gpuCost * (mult>1?1:1)) + '<br><small>One-time hardware purchase</small>', cloud:'$0<br><small>No upfront — pay as you go</small>', hybrid:fmtCurrency(localP.gpuCost) + '<br><small>Hardware + cloud monthly</small>' },
    { label:'💵 Cost ' + period, local:'<strong style="color:'+(cheapest==='local'?'#10b981':'#ef4444')+'">'+fmtCurrency(localM)+'</strong>', cloud:'<strong style="color:'+(cheapest==='cloud'?'#10b981':'#ef4444')+'">'+fmtCurrency(cloudM)+'</strong>', hybrid:'<strong style="color:'+(cheapest==='hybrid'?'#10b981':'#ef4444')+'">'+fmtCurrency(hybridM)+'</strong>' },
    { label:'🔐 Compliance Ready', local:'✅ GDPR / ISO 27001<br><small>No DPA needed — data never leaves</small>', cloud:'✅ SOC 2 / ISO 27001<br><small>DPA required — check provider terms</small>', hybrid:'✅ Best for regulated<br><small>Sensitive data compliant by design</small>' },
    { label:'🏆 Best For', local:'Highly sensitive data<br>Predictable high-volume use<br>Air-gapped environments', cloud:'PoC & fast prototyping<br>Variable/spiky workloads<br>Need latest models always', hybrid:'Enterprise recommended<br>Mix of sensitive + general<br>Cost-optimized at scale' }
  ];

  var localHwCost = localP.firstCost || fmtCurrency(localP.gpuCost);
  var breakEven = '';
  if (localP.gpuCost > 0 && cloudM > localM && mult === 1) {
    var months = Math.round(localP.gpuCost / (cloudM - localM));
    if (months > 0 && months < 120) breakEven = '<br><small>⏱️ Break-even: ~' + months + ' months vs cloud</small>';
  }

  var html = '<div style="overflow-x:auto"><table class="ai-compare-table" style="font-size:12px;width:100%"><thead><tr>';
  html += '<th style="width:16%">Factor</th>';
  html += '<th style="width:28%;background:#f0fdf4;border-bottom:3px solid #10b981">🏠 LOCAL LLM SERVER<br><small>Open-Source · Your Hardware</small></th>';
  html += '<th style="width:28%;background:#ede9fe;border-bottom:3px solid #7c3aed">☁️ CLOUD API<br><small>Pay-per-use · No Hardware</small></th>';
  html += '<th style="width:28%;background:#fef3c7;border-bottom:3px solid #d97706">🔀 HYBRID<br><small>Local + Cloud Router</small></th>';
  html += '</tr></thead><tbody>';

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var isCostRow = row.label.indexOf('Cost') !== -1;
    html += '<tr' + (isCostRow ? ' style="background:#fffbeb;font-size:14px"' : '') + '>';
    html += '<td><strong>' + row.label + '</strong></td>';
    html += '<td style="border-left:3px solid #10b981">' + row.local + (r===8 && breakEven ? breakEven : '') + '</td>';
    html += '<td style="border-left:3px solid #7c3aed">' + row.cloud + '</td>';
    html += '<td style="border-left:3px solid #d97706">' + row.hybrid + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table></div>';

  // Recommendation row
  var rec = cheapest === 'local' ? '🏠 LOCAL is most cost-effective at your usage level. Best for data privacy.' :
            cheapest === 'hybrid' ? '🔀 HYBRID offers the best balance of privacy, capability, and cost — our recommendation for most enterprises.' :
            '☁️ CLOUD is most cost-effective now. Best for speed and flexibility. Re-evaluate as usage grows.';
  html += '<div class="ai-rec-highlight" style="margin-top:12px">💡 <strong>Verdict:</strong> ' + rec + '</div>';

  el.innerHTML = html;
}

function renderCostCards(costs) {
  var grid = document.getElementById('cost-comparison-grid');
  if (!grid) return;
  var tf = document.getElementById('cost-timeframe').value;
  var mult = tf === 'annual' ? 12 : tf === '3year' ? 36 : 1;
  var period = tf === 'annual' ? '/yr' : tf === '3year' ? ' / 3 yr' : '/mo';

  var localD = costs.localCost * mult, cloudD = costs.cloudCost * mult, hybridD = costs.hybridCost * mult;
  var cheapest = localD <= cloudD && localD <= hybridD ? 'local' : cloudD <= hybridD ? 'cloud' : 'hybrid';
  var localP = PRICING.local[STATE.localModel] || PRICING.local['deepseek-v4-pro'];
  var cloudP = (PRICING.cloud[STATE.cloudProvider]||{})[STATE.cloudModelTier] || null;
  var cloudName = cloudP ? cloudP.name : 'Custom';

  var html = '';

  if (STATE.deploymentType !== 'copilot') {
    html += buildCostCard('🖥️ On-Prem LLM', esc(localP.name), localD, period, cheapest==='local', [
      ['GPU Amortized', fmtCurrency(costs.gpuAmortizedMonthly*mult)],
      ['Electricity', fmtCurrency(costs.powerCostMonthly*mult)],
      ['Maintenance', fmtCurrency(costs.maintenanceMonthly*mult)],
      ['Hardware (one-time)', fmtCurrency(costs.localHardwareCost)],
      ['Data Privacy', '✅ 100% On-Prem']
    ]);
  }

  html += buildCostCard('☁️ Cloud LLM', esc(cloudName), cloudD, period, cheapest==='cloud', [
    ['Input ('+fmtNum(costs.totalTokensPerMonth*0.6/1000000)+'M tok)', fmtCurrency((costs.totalTokensPerMonth*0.6/1000000)*(cloudP?cloudP.input:5)*mult)],
    ['Output ('+fmtNum(costs.totalTokensPerMonth*0.4/1000000)+'M tok)', fmtCurrency((costs.totalTokensPerMonth*0.4/1000000)*(cloudP?cloudP.output:15)*mult)],
    ['Per-Query Avg', '$'+((cloudP?(cloudP.input*0.6+cloudP.output*0.4)*STATE.avgTokens/1000:0.01)).toFixed(4)],
    ['Auto-Scaling', '✅ Built-in']
  ]);

  if (STATE.deploymentType !== 'copilot') {
    html += buildCostCard('🔀 Hybrid', 'Local + Cloud', hybridD, period, cheapest==='hybrid', [
      ['50% Local', fmtCurrency(localD*0.5)],
      ['50% Cloud', fmtCurrency(cloudD*0.5)],
      ['Router Overhead', fmtCurrency(50*mult)],
      ['Privacy + Scale', '✅ Best of Both']
    ]);
  }

  if (STATE.deploymentType === 'copilot') {
    html += buildCostCard('🪟 M365 Copilot', STATE.copilotTier.toUpperCase(), costs.cloudCost*mult, period, true, [
      ['Licenses ('+STATE.dau+' users)', fmtCurrency(STATE.dau*30*mult)],
      ['Copilot Studio', fmtCurrency((STATE.copilotTier==='studio'?200:0)*mult)],
      ['Graph Connectors', 'Included'],
      ['M365 Integration', '✅ Native']
    ]);
  }

  var supportCost = (costs.ragCost + costs.memoryCost + costs.mcpCost + costs.infraCost) * mult;
  html += '<div class="ai-cost-card"><div class="ai-cost-card-header">🔧 Supporting Services</div><div class="ai-cost-card-price" style="font-size:24px">' + fmtCurrency(supportCost) + '</div><div class="ai-cost-card-period">' + period + '</div><ul class="ai-cost-card-details"><li><span>RAG / Vector DB</span><span>' + fmtCurrency(costs.ragCost*mult) + '</span></li><li><span>Memory Backend</span><span>' + fmtCurrency(costs.memoryCost*mult) + '</span></li><li><span>MCP / API Layer</span><span>' + fmtCurrency(costs.mcpCost*mult) + '</span></li><li><span>Infrastructure</span><span>' + fmtCurrency(costs.infraCost*mult) + '</span></li></ul></div>';

  grid.innerHTML = html;
}

function buildCostCard(title, model, price, period, isRec, details) {
  var html = '<div class="ai-cost-card' + (isRec?' recommended':'') + '">';
  html += '<div class="ai-cost-card-header">' + title + ' — ' + model + '</div>';
  html += '<div class="ai-cost-card-price">' + fmtCurrency(price) + '</div>';
  html += '<div class="ai-cost-card-period">' + period + '</div>';
  if (isRec) html += '<span class="ai-cost-tag ai-cost-tag-cheapest">💰 Most Cost-Effective</span>';
  html += '<ul class="ai-cost-card-details">';
  for (var i=0;i<details.length;i++) { html += '<li><span>' + details[i][0] + '</span><span>' + details[i][1] + '</span></li>'; }
  html += '</ul></div>';
  return html;
}

function renderCostChart(costs) {
  var chart = document.getElementById('cost-chart');
  if (!chart) return;
  var tf = document.getElementById('cost-timeframe').value;
  var mult = tf === 'annual' ? 12 : tf === '3year' ? 36 : 1;

  var bars = [
    { label:'Cloud\nLLM', val:costs.cloudCost*mult, color:'#8b5cf6' },
    { label:'Local\nLLM', val:costs.localCost*mult, color:'#059669' },
    { label:'Hybrid', val:costs.hybridCost*mult, color:'#d97706' },
    { label:'RAG', val:costs.ragCost*mult, color:'#0891b2' },
    { label:'Memory', val:costs.memoryCost*mult, color:'#f59e0b' },
    { label:'MCP/API', val:costs.mcpCost*mult, color:'#ef4444' },
    { label:'Infra', val:costs.infraCost*mult, color:'#6366f1' }
  ];
  var maxVal = Math.max.apply(null, bars.map(function(b){return b.val;}).concat([1]));

  var html = '';
  for (var i=0;i<bars.length;i++) {
    var h = Math.max((bars[i].val/maxVal)*180, 4);
    html += '<div class="ai-chart-bar-group"><div class="ai-chart-bar-value">' + fmtCurrency(bars[i].val) + '</div><div class="ai-chart-bar" style="height:'+h+'px;background:'+bars[i].color+'"></div><div class="ai-chart-bar-label">' + bars[i].label.replace('\n','<br>') + '</div></div>';
  }
  chart.innerHTML = html;
}

function renderBreakeven(costs) {
  var el = document.getElementById('breakeven-analysis');
  if (!el) return;
  var localM = costs.localCost, cloudM = costs.cloudCost, localHW = costs.localHardwareCost;
  var html = '';

  if (STATE.deploymentType === 'copilot') {
    html += '<p><strong>📊 Copilot pricing is per-user/month.</strong> No hardware investment needed. Best for M365-centric workflows.</p>';
    html += '<div class="ai-breakeven-highlight">💡 <strong>Copilot Cost:</strong> $' + STATE.dau * 30 + '/mo for licenses + $' + (STATE.copilotTier==='studio'?200:0) + '/mo Studio tenant. Predictable, scales linearly with users.</div>';
  } else if (localM < cloudM && localHW > 0) {
    var months = localHW / (cloudM - localM);
    html += '<p><strong>📊 Local LLM is cheaper per month</strong> — but requires upfront hardware.</p>';
    html += '<div class="ai-breakeven-highlight"><strong>⏱️ Break-Even:</strong> <span style="font-size:18px;font-weight:800;color:#6366f1">' + Math.round(months) + ' months</span> (' + (months/12).toFixed(1) + ' years)<br>After this, you <strong>save ' + fmtCurrency(cloudM - localM) + '/mo</strong> vs cloud.<br><strong>3-Year Savings:</strong> ' + fmtCurrency(cloudM*36 - (localHW + (costs.powerCostMonthly+costs.maintenanceMonthly+200)*36)) + '</div>';
  } else if (cloudM < localM) {
    html += '<p><strong>📊 Cloud is cheaper per month</strong> — no upfront investment.</p>';
    html += '<div class="ai-breakeven-highlight"><strong>💡 Cloud Advantage:</strong> Save <span style="font-size:18px;font-weight:800;color:#10b981">' + fmtCurrency(localM - cloudM) + '/mo</span> by using cloud.<br>Local hardware (' + fmtCurrency(localHW) + ') would <strong>never break even</strong> at current usage (' + fmtNum(STATE.dau) + ' DAU).<br><strong>Increase DAU or queries</strong> to change this.</div>';
  } else {
    html += '<p><strong>📊 Costs are approximately equal.</strong> Consider non-financial factors: data privacy, latency, customization needs.</p>';
  }
  html += '<p style="margin-top:12px;font-size:12px;color:var(--ai-text-muted)">💡 <em>Tip: Change DAU, queries/user, or pilot phase to see how scale affects break-even. Local LLMs become more cost-effective at 20+ DAU.</em></p>';
  el.innerHTML = html;
}

// ═══════════════════════════════════ SUMMARY VIEW ═══════════════════════
function renderSummaryView() {
  var el = document.getElementById('summary-content');
  if (!el) return;
  var costs = calcCosts();
  var dailyQ = STATE.dau * STATE.queriesPerUser;

  // ── Build device options for local/hybrid ──
  var localModels = PRICING.local;
  var deviceOptions = '';
  var modelKeys = Object.keys(localModels);
  for (var mk = 0; mk < modelKeys.length; mk++) {
    var m = localModels[modelKeys[mk]];
    deviceOptions += '<option value="' + modelKeys[mk] + '">' + esc(m.name) + ' — ' + esc(m.firstCost||fmtCurrency(m.gpuCost)) + '</option>';
  }

  var html = '';

  // ═══════════ MEMORY CLARIFICATION ═══════════
  html += '<div class="ai-card" style="margin-bottom:12px;border-left:4px solid #f59e0b">';
  html += '<div class="ai-card-header"><span class="ai-card-title">⚠️ Important: Memory Works with API-Based Apps — Not Public Chat UIs</span></div>';
  html += '<div style="font-size:12px;line-height:1.7;padding:4px 0">';
  html += 'External memory (Redis/Mem0) <strong>cannot</strong> be injected into ChatGPT Web, Claude Web, or MS Copilot Web — these are third-party black boxes. ';
  html += '<strong>The solution:</strong> Build ONE custom chat application (web-based) that connects to ANY LLM API (OpenAI, Claude, DeepSeek, or your local Ollama). ';
  html += 'This app automatically sends every conversation to the Memory API and retrieves context before each LLM call. ';
  html += '<strong>For privacy:</strong> Use Redis Stack OSS (free, self-hosted) + Mem0 OSS (free, self-hosted) or Letta/MemGPT (free OSS) — all data stays on your servers. ';
  html += '<strong>See the 🧠 Memory System tab for full library comparison.</strong>';
  html += '</div></div>';

  // ═══════════ THREE SOLUTION COLUMNS ═══════════
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">';

  // ── SOLUTION 1: COMPLETE CLOUD ──
  html += '<div style="background:var(--ai-surface);border:2px solid #7c3aed;border-radius:12px;overflow:hidden">';
  html += '<div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:12px 14px;font-size:15px;font-weight:700">☁️ Complete Cloud</div>';
  html += '<div style="padding:14px;font-size:12px;line-height:1.7">';

  html += '<strong>🏗️ Architecture:</strong><br>';
  html += 'All LLM calls via Cloud APIs — zero hardware. Your custom chat app (web-based) connects to OpenAI, Anthropic, DeepSeek, or Google. Memory stored in Redis/Mem0 cloud.<br><br>';

  html += '<strong>🤖 Recommended Models:</strong><br>';
  html += '• Budget: DeepSeek V4 Pro API — $0.14/$0.28 per M tok<br>';
  html += '• Balanced: GPT-5.4 Mini — $0.75/$4.50 per M tok<br>';
  html += '• Premium: Claude Sonnet 4.6 — $3/$15 per M tok<br><br>';

  html += '<strong>💰 Estimated Cost:</strong><br>';
  html += '• ' + fmtNum(dailyQ) + ' queries/day ≈ ' + fmtNum(costs.monthlyQueries) + ' queries/month<br>';
  html += '• Cloud API: ~' + fmtCurrency(costs.cloudCost) + '/mo<br>';
  html += '• Memory (Redis + Mem0): ~$130/mo<br>';
  html += '• <strong>Total: ~' + fmtCurrency(costs.cloudCost + 130) + '/mo</strong><br><br>';

  html += '<strong>✅ Best For:</strong><br>';
  html += '• Fastest setup (1-3 days)<br>• Zero hardware · Zero maintenance<br>• Always latest models<br>• Variable/spiky workloads<br>• PoC and pilot phases<br><br>';

  html += '<strong>⚠️ Considerations:</strong><br>';
  html += '• Data leaves your network<br>• Costs scale with usage<br>• Internet connection required<br>• Vendor dependency risk';

  html += '</div></div>';

  // ── SOLUTION 2: COMPLETE LOCAL ──
  html += '<div style="background:var(--ai-surface);border:2px solid #059669;border-radius:12px;overflow:hidden">';
  html += '<div style="background:linear-gradient(135deg,#059669,#047857);color:#fff;padding:12px 14px;font-size:15px;font-weight:700">🏠 Complete Local</div>';
  html += '<div style="padding:14px;font-size:12px;line-height:1.7">';

  html += '<strong>🏗️ Architecture:</strong><br>';
  html += 'Everything on YOUR hardware. Open-source LLM on local GPU. Redis/Mem0 self-hosted. Custom chat app served from your network. Nothing leaves premises.<br><br>';

  html += '<strong>🖥️ Select Device:</strong><br>';
  html += '<select class="ai-select" id="summary-local-device" onchange="updateSummaryDevice()" style="width:100%;font-size:11px">' + deviceOptions + '</select><br>';
  html += '<small style="color:var(--ai-text-muted)" id="summary-local-spec"></small><br><br>';

  html += '<strong>💰 Estimated Cost:</strong><br>';
  html += '• GPU amortized (3yr): ' + fmtCurrency(costs.gpuAmortizedMonthly) + '/mo<br>';
  html += '• Electricity: ' + fmtCurrency(costs.powerCostMonthly) + '/mo<br>';
  html += '• Maintenance: $50/mo<br>';
  html += '• Memory (self-hosted Redis + Mem0 OSS): <strong>Free</strong><br>';
  html += '• <strong>Total: ~' + fmtCurrency(costs.localCost) + '/mo</strong><br>';
  html += '• <strong>One-time HW: ' + fmtCurrency(costs.localHardwareCost) + '</strong><br><br>';

  html += '<strong>✅ Best For:</strong><br>';
  html += '• Maximum privacy & compliance<br>• Predictable cost at scale<br>• Air-gapped environments<br>• High-volume steady usage<br>• Full data sovereignty<br><br>';

  html += '<strong>⚠️ Considerations:</strong><br>';
  html += '• Upfront hardware cost<br>• You manage GPU & updates<br>• Limited to open-weight models<br>• Scaling requires more GPUs';

  html += '</div></div>';

  // ── SOLUTION 3: HYBRID ──
  html += '<div style="background:var(--ai-surface);border:2px solid #d97706;border-radius:12px;overflow:hidden">';
  html += '<div style="background:linear-gradient(135deg,#d97706,#b45309);color:#fff;padding:12px 14px;font-size:15px;font-weight:700">🔀 Hybrid ⭐</div>';
  html += '<div style="padding:14px;font-size:12px;line-height:1.7">';

  html += '<strong>🏗️ Architecture:</strong><br>';
  html += 'Sensitive data → local GPU. General queries → cloud API. Smart router classifies each request. Best of both worlds.<br><br>';

  html += '<strong>🖥️ Select Local Device:</strong><br>';
  html += '<select class="ai-select" id="summary-hybrid-device" onchange="updateSummaryDevice()" style="width:100%;font-size:11px">' + deviceOptions + '</select><br>';
  html += '<small style="color:var(--ai-text-muted)" id="summary-hybrid-spec"></small><br><br>';

  html += '<strong>💰 Estimated Cost:</strong><br>';
  html += '• Local GPU + Cloud API combined<br>';
  html += '• <strong>Total: ~' + fmtCurrency(costs.hybridCost) + '/mo</strong><br>';
  html += '• <strong>One-time HW: ' + fmtCurrency(costs.localHardwareCost) + '</strong><br><br>';

  html += '<strong>✅ Best For:</strong><br>';
  html += '• Enterprise recommended<br>• Mix of sensitive + general work<br>• Privacy + latest models<br>• Cost-optimized routing<br>• No vendor lock-in<br><br>';

  html += '<strong>⚠️ Considerations:</strong><br>';
  html += '• More complex setup<br>• Two environments to monitor<br>• Data classification policy needed';

  html += '</div></div>';

  html += '</div>'; // end three columns

  // ── IMPLEMENTATION NOTE ──
  html += '<div class="ai-rec-highlight" style="margin-top:12px">';
  html += '<strong>🏗️ The App You Need:</strong> A custom web-based chat application (Python/FastAPI or Node.js) that:<br>';
  html += '<strong>1.</strong> Provides ONE interface for users — regardless of which LLM powers it behind the scenes.<br>';
  html += '<strong>2.</strong> Connects to your chosen LLM (Cloud API, Local Ollama, or both via Hybrid router).<br>';
  html += '<strong>3.</strong> Automatically sends every conversation to Redis/Mem0 Memory API.<br>';
  html += '<strong>4.</strong> Retrieves relevant memories and embeds them in the system prompt before each LLM call.<br>';
  html += '<strong>5.</strong> Works identically whether you choose Cloud, Local, or Hybrid — swap the backend without changing the user experience.<br>';
  html += '<strong>📋 Use the Plan tab for detailed implementation steps. Use ⚙️ Configure to adjust parameters.</strong>';
  html += '</div>';

  el.innerHTML = html;

  // Set default device selections
  setTimeout(function() {
    var selLocal = document.getElementById('summary-local-device');
    var selHybrid = document.getElementById('summary-hybrid-device');
    if (selLocal) selLocal.value = STATE.localModel;
    if (selHybrid) selHybrid.value = STATE.localModel;
    updateSummaryDevice();
  }, 100);
}

// ── Update device specs in summary when selection changes ──
function updateSummaryDevice() {
  var selLocal = document.getElementById('summary-local-device');
  var selHybrid = document.getElementById('summary-hybrid-device');
  var modelKey = (selLocal && selLocal.value) || (selHybrid && selHybrid.value) || STATE.localModel;
  var m = PRICING.local[modelKey];
  if (!m) return;
  var spec = '🖥️ ' + esc(m.hardware||m.vram) + ' | 💵 ' + esc(m.firstCost||fmtCurrency(m.gpuCost)) + ' | ⚡ ' + esc(m.usageCost||'') + ' | 🚀 ' + m.tokensPerSec + ' tok/s';
  var elLocal = document.getElementById('summary-local-spec');
  var elHybrid = document.getElementById('summary-hybrid-spec');
  if (elLocal) elLocal.innerHTML = spec;
  if (elHybrid) elHybrid.innerHTML = spec;
}


// ═══════════════════════════════════ MEMORY SYSTEM VIEW ═══════════════════════
function renderMemoryView() {
  var container = document.getElementById('memory-diagram-svg');
  if (!container) return;

  if (!window.mermaid) {
    container.innerHTML = '<div class="ai-empty" style="padding:40px;text-align:center">⏳ Loading Mermaid…</div>';
    return;
  }

  var diagramDef = [
    'flowchart TB',
    '  classDef app       fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#3730a3',
    '  classDef gateway   fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#78350f',
    '  classDef process   fill:#e0f2fe,stroke:#0891b2,stroke-width:2px,color:#164e63',
    '  classDef store     fill:#dcfce7,stroke:#16a34a,stroke-width:3px,color:#14532d',
    '  classDef prompt    fill:#fce7f3,stroke:#be185d,stroke-width:2px,color:#831843',
    '  classDef llm       fill:#7c3aed,stroke:#5b21b6,stroke-width:3px,color:#fff',
    '',
    '  subgraph APPS["📱 YOUR APPS — Every tool sends & receives memories"]',
    '    direction LR',
    '    ephorm["🏢 Ephorm Audit<br/>Audit workflows"]',
    '    copilot["🪟 MS Copilot<br/>M365 · Teams · Office"]',
    '    vscode["💻 VS Code Chat<br/>Developer assistant"]',
    '    web["🌐 Web Chat<br/>Customer portal"]',
    '    custom["🔧 Custom Apps<br/>Internal tools"]',
    '  end',
    '',
    '  subgraph GATEWAY["🔌 Memory API Gateway — Single entry point for ALL apps"]',
    '    api["🌐 REST API / Redis Protocol<br/>Any language · Any app · Any platform<br/>POST /memories — Write<br/>GET /memories/search — Read"]',
    '  end',
    '',
    '  subgraph PROCESS["⚙️ Memory Processing Engine"]',
    '    direction LR',
    '    extract["🔍 1. Extract Facts<br/>Client XYZ = Manufacturing<br/>Revenue = $50M<br/>User prefers bullet points"]',
    '    entity["🏷️ 2. Entity Recognition<br/>People · Companies · Dates<br/>Documents · Topics · Projects"]',
    '    preference["⭐ 3. Preference Learning<br/>Format: Bullet points<br/>Standards: IFRS citations<br/>Templates: PKF-ENG-2024"]',
    '  end',
    '',
    '  subgraph STORE["💾 Memory Store — Structured + Vector"]',
    '    redis["🗄️ Redis Stack<br/>Key-Value + JSON + Vectors<br/>{user}:{topic}:facts<br/>{user}:{topic}:preferences<br/>TTL: Configurable retention"]',
    '    vector["🔢 Vector Embeddings<br/>Semantic search across all memories<br/>&quot;Find everything about client XYZ&quot;<br/>-&gt; Returns facts from ALL apps"]',
    '  end',
    '',
    '  subgraph ENRICH["📦 Prompt Enrichment — Every query gets context"]',
    '    fetch["📥 Fetch Relevant Memories<br/>1. User asks question in ANY app<br/>2. Memory API searches for relevant facts<br/>3. Returns: user prefs + entity facts + past context"]',
    '    embed["📝 Embed in Prompt<br/>System Prompt + Memory Context +<br/>RAG Documents + User Query =<br/>Complete Personalized Prompt"]',
    '  end',
    '',
    '  LLM["🧠 LLM — AI Model<br/>Receives enriched prompt<br/>Answers with full context<br/>Personalized · Accurate · Consistent"]',
    '',
    '  ephorm & copilot & vscode & web & custom --> api',
    '  api --> extract & entity & preference',
    '  extract & entity & preference --> redis & vector',
    '  redis & vector --> fetch',
    '  fetch --> embed',
    '  embed --> LLM',
    '  LLM -.->|"Response + new memories"| api',
    '',
    '  class ephorm,copilot,vscode,web,custom app',
    '  class api gateway',
    '  class extract,entity,preference process',
    '  class redis,vector store',
    '  class fetch,embed prompt',
    '  class LLM llm'
  ].join('\n');

  container.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px">⏳ Rendering memory architecture…</div>';
  var diagId = 'mem' + Date.now();
  mermaid.render(diagId, diagramDef).then(function(result) {
    container.innerHTML = result.svg;
    if (result.bindFunctions) result.bindFunctions(container);
  }).catch(function(err) {
    console.error('Memory diagram error:', err);
    container.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:12px">⚠️ Diagram render error: ' + esc(String(err.message || err)) + '</div>';
  });
}

// ═══════════════════════════════════ PLAN & RECOMMEND VIEW ═══════════════════════════════════
function renderPlanView() {
  var costs = calcCosts();
  renderRecommendation(costs);
  renderPoCPlan(costs);
  renderRisks();
  renderFullPlan(costs);
  renderAsciiDiagram();
  var ts = document.getElementById('plan-timestamp');
  if (ts) ts.textContent = 'Generated ' + new Date().toLocaleString();
}

function renderRecommendation(costs) {
  var el = document.getElementById('plan-recommendation');
  if (!el) return;
  var rec = getTopRecommendation();
  var html = '<div class="ai-rec-highlight" style="margin-bottom:12px">🏆 <strong>' + esc(rec.title) + '</strong></div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;line-height:1.7">';

  html += '<div style="background:var(--ai-primary-bg);border-radius:8px;padding:12px">';
  html += '<strong>🏗️ Architecture</strong><br>' + rec.architecture + '</div>';

  html += '<div style="background:var(--ai-success-bg);border-radius:8px;padding:12px">';
  html += '<strong>💰 Cost Plan</strong><br>' + rec.cost + '</div>';

  html += '<div style="background:var(--ai-accent-bg);border-radius:8px;padding:12px">';
  html += '<strong>🧠 Memory Plan</strong><br>' + rec.memory + '</div>';

  html += '<div style="background:var(--ai-info-bg);border-radius:8px;padding:12px">';
  html += '<strong>📅 Timeline:</strong> ' + rec.timeline + '<br><br><strong>⚡ Next Steps:</strong><br>' + rec.nextSteps + '</div>';

  html += '</div>';
  el.innerHTML = html;
}

function getTopRecommendation() {
  var costs = calcCosts();
  var localP = PRICING.local[STATE.localModel] || PRICING.local['deepseek-v4-pro'];
  var cloudP = (PRICING.cloud[STATE.cloudProvider]||{})[STATE.cloudModelTier] || null;
  var isHybrid = STATE.deploymentType === 'hybrid';
  var isLocal = STATE.deploymentType === 'local';
  var isCloud = STATE.deploymentType === 'cloud';
  var isCopilot = STATE.deploymentType === 'copilot';

  // Build comprehensive summary
  var arch = '';
  if (isCopilot) {
    arch = '<strong>Copilot Studio + M365 Agents</strong> — fastest path if M365-centric. Custom MCP connectors for Ephorm Audit/Tax.';
  } else if (isLocal) {
    arch = '<strong>100% On-Premises</strong> — ' + esc(localP.name) + ' on ' + esc(localP.hardware || localP.vram) + '. Full data sovereignty, zero per-token cost.';
  } else if (isCloud) {
    arch = '<strong>Cloud API</strong> — ' + esc(cloudP?cloudP.name:'Cloud LLM') + '. Zero hardware, pay-per-use, always latest models.';
  } else {
    arch = '<strong>Hybrid (Recommended)</strong> — Sensitive data on ' + esc(localP.name) + ' (local GPU), complex reasoning on ' + esc(cloudP?cloudP.name:'Cloud API') + '. Smart routing by data classification.';
  }

  var cost = '';
  if (isCopilot) {
    cost = '<strong>$' + (STATE.dau * 30) + '/mo</strong> licenses ($30/user × ' + STATE.dau + ' users) + $200/mo Copilot Studio. Total: <strong>' + fmtCurrency(costs.totalMonthly) + '/mo</strong>.';
  } else if (isLocal) {
    cost = '<strong>' + fmtCurrency(costs.totalMonthly) + '/mo</strong> total. GPU amortized: ' + fmtCurrency(localP.gpuCost/36) + '/mo (3yr). Electricity: ' + fmtCurrency(costs.powerCostMonthly) + '/mo. Maintenance: $50/mo. <strong>Zero per-token cost.</strong>';
  } else if (isCloud) {
    cost = '<strong>' + fmtCurrency(costs.totalMonthly) + '/mo</strong> estimated. ' + fmtNum(costs.monthlyQueries) + ' queries/month at ~' + fmtNum(STATE.avgTokens) + ' tokens each. <strong>Per-query avg: ~$' + (costs.cloudCost/costs.monthlyQueries).toFixed(4) + '</strong>. <em>With prompt caching: up to 90% less on repeated prompts.</em>';
  } else {
    cost = '<strong>' + fmtCurrency(costs.totalMonthly) + '/mo</strong> total. Local: ' + fmtCurrency(costs.localCost) + '/mo, Cloud: ' + fmtCurrency(costs.cloudCost) + '/mo. Hybrid router overhead: $50/mo.';
  }

  var memory = '';
  if (STATE.memoryStrategy === 'external-shared') {
    memory = '<strong>External Shared Memory (Redis + Mem0)</strong> — ALL apps share one memory backbone. User preferences, entity facts, conversation history stored centrally. Any app query fetches relevant context automatically.';
  } else if (STATE.memoryStrategy === 'copilot-builtin') {
    memory = '<strong>Copilot Built-in Memory</strong> — limited to M365 Graph. Consider adding Redis for cross-app memory if you add non-Microsoft tools.';
  } else {
    memory = '<strong>App-Internal Memory</strong> — each app has separate memory. Upgrade to External Shared for cross-app continuity.';
  }

  return {
    title: isHybrid ? 'Hybrid Architecture — Best Balance of Privacy, Capability & Cost' :
           isLocal ? 'On-Prem Architecture — Maximum Privacy & Control' :
           isCloud ? 'Cloud-First Architecture — Fastest Path to Value' :
           'Copilot-First — Leverage Existing M365 Investment',
    architecture: arch,
    cost: cost,
    memory: memory,
    timeline: isCopilot ? '4-6 weeks (PoC), 8-12 weeks (Pilot)' :
              isCloud ? '2-4 weeks (PoC), 8-12 weeks (Pilot)' :
              isHybrid ? '4-8 weeks (PoC), 12-16 weeks (Pilot)' :
              '8-12 weeks (PoC), 16-20 weeks (Pilot)',
    nextSteps: '<strong>1.</strong> Set up ' + (isLocal||isHybrid ? esc(localP.name) + ' on ' + esc(localP.hardware||localP.vram) + ' via Ollama' : 'Cloud API access for ' + esc(cloudP?cloudP.name:'your provider')) + '.<br><strong>2.</strong> Deploy Redis Stack as cross-app memory backbone.<br><strong>3.</strong> Build one pilot use case: ' + (STATE.useCases[0] ? (findUseCase(STATE.useCases[0])||{}).name || STATE.useCases[0] : 'Event Bot') + '.<br><strong>4.</strong> Measure accuracy, latency, user satisfaction for 2 weeks.<br><strong>5.</strong> Go/No-Go: accuracy >80%, user satisfaction >4/5 = expand to next use case.'
  };
}

function renderPoCPlan(costs) {
  var el = document.getElementById('plan-poc');
  if (!el) return;
  var items = [
    { label: 'Target Use Case', value: STATE.useCases.map(function(id){var u=findUseCase(id);return u?u.name:id;}).join(', ') },
    { label: 'Pilot Phase', value: STATE.pilotPhase === 'poc' ? 'PoC (2-3 users)' : STATE.pilotPhase === 'pilot' ? 'Pilot (5-10 users)' : STATE.pilotPhase === 'scale' ? 'Scale-Up (20+ users)' : 'Production (50+ users)' },
    { label: 'Timeline', value: STATE.pilotPhase === 'poc' ? '4-6 weeks' : STATE.pilotPhase === 'pilot' ? '8-16 weeks' : '12-24 weeks' },
    { label: 'Owner', value: 'AI & Automation Team Lead' },
    { label: 'Monthly Budget', value: fmtCurrency(costs.totalMonthly) },
    { label: 'Key Deliverable', value: 'Working agent(s) with measured accuracy & response time' },
    { label: 'Success Metric', value: '80%+ query accuracy, <3s response, user satisfaction 4/5' },
    { label: 'Go/No-Go Criteria', value: 'Accuracy <70% or user satisfaction <3/5 = revise approach before scaling' }
  ];
  var html = '<div class="ai-poc-grid">';
  for (var i=0;i<items.length;i++) {
    html += '<div class="ai-poc-item"><div class="ai-poc-label">' + esc(items[i].label) + '</div><div class="ai-poc-value">' + esc(items[i].value) + '</div></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderRisks() {
  var el = document.getElementById('plan-risks');
  if (!el) return;
  var risks = [
    { level:'high',   title:'Agentic Safety — Unintended Actions',          desc:'Autonomous agents can take real, hard-to-reverse actions (file, send, update records). Mitigation: Human-in-the-loop approval gate before all irreversible actions (LangGraph interrupt()), Llama Guard 3 output safety filter, maximum 1 agentic step before review.' },
    { level:'high',   title:'Client Data Privacy (Cloud LLM APIs)',           desc:'Sending audit client data to GPT-4.1 / Claude / Gemini APIs may violate engagement letters and GDPR. Mitigation: On-prem LLM (Llama 4 / DeepSeek V3) for client-named data, data anonymization pipeline before cloud calls, explicit data classification policy.' },
    { level:'medium', title:'LLM Hallucination on Audit Standards',             desc:'Models confidently cite incorrect audit standards or fabricate document sections. Mitigation: RAG with authoritative PKF documents, Reviewer Agent to cross-check against source, confidence thresholds, RAG citations shown to user in every response.' },
    { level:'medium', title:'MCP Tool Security (Anthropic Spec, 2025)',          desc:'MCP tools can access filesystems, databases, and external APIs. A misconfigured or prompt-injected tool call can cause data exposure. Mitigation: OAuth 2.1 authorization per tool (new MCP 2025 spec), principle of least privilege, full audit log of all tool calls.' },
    { level:'medium', title:'Model Collapse / Quality Drift',                    desc:'Using AI to generate training data or repeatedly fine-tuning on AI outputs causes model quality to degrade over time. Mitigation: Never train exclusively on AI outputs, maintain human-verified evaluation benchmarks, monitor quality drift with LangFuse / LangSmith.' },
    { level:'medium', title:'User Adoption — Trust and Workflow Change',          desc:'Auditors may not trust AI output or resist changing established workflows. Mitigation: Start with low-risk use cases (Event Bot), demonstrate measurable time savings with metrics, transparent RAG citations, always human-in-the-loop design.' },
    { level:'low',    title:'Context Window Cost Creep',                          desc:'GPT-4.1 supports 1M-token contexts but costs $2/M input tokens. Large contexts accumulate fast. Mitigation: Intelligent chunking, RAG reduces context size needed, Mem0 for efficient memory management, context budgeting per query.' },
    { level:'low',    title:'Open-Weight Model Versioning',                       desc:'Llama 4 / Qwen 2.5 / DeepSeek V3 may be superseded by new versions within months. Mitigation: Abstract model interface layer via Ollama or vLLM, continuous evaluation of new releases against your benchmark suite, easy model swap design.' }
  ];
  var html = '';
  for (var i=0;i<risks.length;i++) {
    var r = risks[i];
    html += '<div class="ai-risk-card"><span class="ai-risk-level ai-risk-' + r.level + '">' + r.level.toUpperCase() + '</span><div class="ai-risk-title">' + esc(r.title) + '</div><div class="ai-risk-desc">' + esc(r.desc) + '</div></div>';
  }
  el.innerHTML = html;
}

function renderFullPlan(costs) {
  var el = document.getElementById('plan-content');
  if (!el) return;
  var localP = PRICING.local[STATE.localModel] || PRICING.local['deepseek-v4-pro'];
  var cloudP = (PRICING.cloud[STATE.cloudProvider]||{})[STATE.cloudModelTier] || null;
  var cloudName = cloudP ? cloudP.name : 'Custom';
  var rec = getTopRecommendation();
  var useCaseNames = STATE.useCases.map(function(id){var u=findUseCase(id);return u?u.name:id;});

  var plan = '';
  plan += '══════════════════════════════════════════════\n';
  plan += '  AI AGENT ARCHITECTURE DEPLOYMENT PLAN\n';
  plan += '  ' + esc(STATE.companyName) + ' — v' + new Date().toISOString().slice(0,10) + '\n';
  plan += '══════════════════════════════════════════════\n\n';

  plan += '┌─ EXECUTIVE RECOMMENDATION ──────────────────\n';
  plan += '│ ' + rec.title + '\n';
  plan += '│ Cost: ' + fmtCurrency(costs.totalMonthly) + '/mo | Timeline: ' + rec.timeline + '\n';
  plan += '│ Owner: ' + rec.owner + '\n';
  plan += '│ Success: ' + rec.success + '\n';
  plan += '└────────────────────────────────────────────\n\n';

  plan += '┌─ 1. LLM INFERENCE ─────────────────────────\n';
  plan += '│ Strategy: ' + STATE.deploymentType.toUpperCase() + '\n';
  if (STATE.deploymentType === 'copilot') {
    plan += '│ 🪟 Copilot Tier: ' + STATE.copilotTier + '\n│ License: $30/user/mo × ' + STATE.dau + ' users\n';
  }
  if (STATE.deploymentType === 'local' || STATE.deploymentType === 'hybrid') {
    plan += '│ 🖥️ Model: ' + esc(localP.name) + ' | Runtime: ' + STATE.localRuntime + '\n';
    plan += '│ GPU: ' + esc(localP.vram) + ' | HW: ' + fmtCurrency(localP.gpuCost) + '\n';
  }
  if (STATE.deploymentType === 'cloud' || STATE.deploymentType === 'hybrid') {
    plan += '│ ☁️ Provider: ' + STATE.cloudProvider + ' | Model: ' + esc(cloudName) + '\n';
    if (cloudP) plan += '│ Pricing: $' + cloudP.input + '/$' + cloudP.output + ' per M tokens\n';
  }
  plan += '│ DAU: ' + STATE.dau + ' | Queries/user: ' + STATE.queriesPerUser + ' | Tokens/query: ' + STATE.avgTokens + '\n';
  plan += '│ Monthly queries: ' + fmtNum(costs.monthlyQueries) + '\n';
  plan += '└────────────────────────────────────────────\n\n';

  plan += '┌─ 2. AGENT WORKFLOW ────────────────────────\n';
  plan += '│ Pattern: Orchestrator → Workers (Doer, Reviewer, Tool, Manager) — Anthropic/Google/OpenAI standard 2024-25\n';
  plan += '│ Persona: ' + STATE.agentPersona + '\n';
  plan += '│ Orchestrator: ' + (STATE.deploymentType==='copilot'?'Copilot Studio':'LangGraph 0.2+ state-machine + MCP tools') + '\n';
  plan += '│ Review/Approval: Human-in-the-loop with escalation\n';
  plan += '└────────────────────────────────────────────\n\n';

  plan += '┌─ 3. RAG & MEMORY ──────────────────────────\n';
  plan += '│ RAG: ' + STATE.ragEnabled + ' | DB: ' + STATE.vectorDb + ' | Embed: ' + STATE.embeddingModel + '\n';
  plan += '│ Memory Strategy: ' + STATE.memoryStrategy + '\n';
  plan += '│ User: ' + STATE.userMemory + ' | Company: ' + STATE.companyMemory + ' | App: ' + STATE.appMemory + ' | External: ' + STATE.externalMemory + '\n';
  plan += '│ Backend: ' + STATE.memoryBackend + ' | Retention: ' + STATE.userMemoryRetention + '\n';
  plan += '└────────────────────────────────────────────\n\n';

  plan += '┌─ 4. APP CONNECTORS ────────────────────────\n';
  plan += '│ Connected: ' + STATE.appConnectors.join(', ') + '\n';
  plan += '│ MCP: ' + STATE.mcpEnabled + ' | Tools: ' + STATE.mcpTools.join(', ') + '\n';
  plan += '│ Workers: ' + STATE.workers + '\n';
  plan += '└────────────────────────────────────────────\n\n';

  plan += '┌─ 5. USE CASES & PILOT ─────────────────────\n';
  plan += '│ Phase: ' + STATE.pilotPhase + '\n│ Use Cases: ' + useCaseNames.join(', ') + '\n';
  plan += '│ Users: ' + STATE.dau + ' | Queries/day: ' + fmtNum(costs.dailyQueries) + '\n';
  plan += '└────────────────────────────────────────────\n\n';

  plan += '┌─ 6. SOFTWARE STACK ────────────────────────\n';
  for (var g=0;g<SOFTWARE_STACK.length;g++) {
    var grp = SOFTWARE_STACK[g];
    plan += '│ ' + grp.category + ':\n';
    for (var s=0;s<grp.items.length;s++) { plan += '│   - ' + grp.items[s].name + ' (' + grp.items[s].cost + ')\n'; }
  }
  plan += '└────────────────────────────────────────────\n\n';

  plan += '══════════════════════════════════════════════\n';
  plan += '  TOTAL MONTHLY: ' + fmtCurrency(costs.totalMonthly) + '\n';
  plan += '  TOTAL ANNUAL:  ' + fmtCurrency(costs.totalAnnual) + '\n';
  plan += '  3-YEAR TCO:    ' + fmtCurrency(costs.total3Year) + '\n';
  plan += '══════════════════════════════════════════════\n';

  el.textContent = plan;
}

function renderAsciiDiagram() {
  var el = document.getElementById('plan-ascii-diagram');
  if (!el) return;
  var ascii = '';
  ascii += '┌──────────────────────────────────────────────────────────────────────┐\n';
  ascii += '│              ' + padRight(esc(STATE.companyName).toUpperCase() + ' AI AGENT ARCHITECTURE', 56) + '│\n';
  ascii += '├──────────────────────────────────────────────────────────────────────┤\n';
  ascii += '│                                                                      │\n';
  ascii += '│  USER ──▶ AGENT/WORKFLOW ──▶ COPILOT ──▶ SYSTEM PROMPT ──▶ RAG     │\n';
  ascii += '│            Doer→Reviewer→Mgr    (M365)                               │\n';
  ascii += '│                                                                      │\n';
  ascii += '│  MEMORY LAYER:                                                       │\n';
  ascii += '│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐       │\n';
  ascii += '│  │  USER    │ │ COMPANY  │ │   APP    │ │ EXTERNAL SHARED  │       │\n';
  ascii += '│  │  MEMORY  │ │  MEMORY  │ │  MEMORY  │ │     MEMORY       │       │\n';
  ascii += '│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘       │\n';
  ascii += '│                                                                      │\n';
  ascii += '│  APP CONNECTORS ──▶ API/MCP LAYER ──▶ FINE-TUNING (separate)       │\n';
  ascii += '│  Ephorm,CaseWare                                                     │\n';
  ascii += '│                                                                      │\n';
  ascii += '│       ┌──────────┐    ┌──────────┐    ┌──────────────┐             │\n';
  ascii += '│       │ ON-PREM  │    │  CLOUD   │    │   HYBRID     │             │\n';
  ascii += '│       │   LLM    │    │   LLM    │    │   ROUTER     │             │\n';
  ascii += '│       └────┬─────┘    └────┬─────┘    └──────┬───────┘             │\n';
  ascii += '│            │               │                  │                      │\n';
  ascii += '│            └───────────────┼──────────────────┘                      │\n';
  ascii += '│                            │                                         │\n';
  ascii += '│                   REVIEW & APPROVAL                                  │\n';
  ascii += '│                 (Human-in-the-Loop)                                  │\n';
  ascii += '│                            │                                         │\n';
  ascii += '│                      📤 RESPONSE                                    │\n';
  ascii += '│                                                                      │\n';
  ascii += '├──────────────────────────────────────────────────────────────────────┤\n';
  ascii += '│ DEPLOY: ' + padRight(STATE.deploymentType, 10) + '│ USERS: ' + padRight(String(STATE.dau), 6) + '│ COST: ' + padRight(fmtCurrency(calcCosts().totalMonthly)+'/mo', 14) + '│ PHASE: ' + padRight(STATE.pilotPhase, 10) + '│\n';
  ascii += '└──────────────────────────────────────────────────────────────────────┘\n';
  el.textContent = ascii;
}

function padRight(str, len) { str = String(str); while (str.length < len) str += ' '; return str; }

function copyPlan() {
  var el = document.getElementById('plan-content');
  var text = el ? el.textContent || '' : '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function(){ tool.notify('Plan copied!','success'); }).catch(function(){ tool.notify('Copy failed','error'); });
  } else {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); tool.notify('Plan copied!','success'); } catch(e) { tool.notify('Copy failed','error'); }
    document.body.removeChild(ta);
  }
}
