"""
Genera submission.pdf para The Stablecoins Commerce Stack Challenge
Track 4 — Best Agentic Economy Experience on Arc
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

OUTPUT = "/home/xabier/arcdev/acrtxscript/agentwork/AgentWork_Submission.pdf"

# ── Colores ───────────────────────────────────────────────────────────────────
INDIGO   = colors.HexColor("#4F46E5")
INDIGO_L = colors.HexColor("#EEF2FF")
GRAY     = colors.HexColor("#6B7280")
DARK     = colors.HexColor("#111827")
GREEN    = colors.HexColor("#059669")
WHITE    = colors.white

# ── Estilos ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def style(name, **kw):
    s = styles[name].clone(name + str(id(kw)))
    for k, v in kw.items():
        setattr(s, k, v)
    return s

H1    = style("Heading1", fontSize=22, textColor=INDIGO, spaceAfter=4, leading=26)
H2    = style("Heading2", fontSize=13, textColor=INDIGO, spaceBefore=14, spaceAfter=4, leading=16)
BODY  = style("Normal",   fontSize=10, textColor=DARK,  leading=15, spaceAfter=4, alignment=TA_JUSTIFY)
SMALL = style("Normal",   fontSize=9,  textColor=GRAY,  leading=13)
CODE  = style("Normal",   fontSize=8.5, fontName="Courier", textColor=DARK, leading=13, backColor=colors.HexColor("#F9FAFB"))
LABEL = style("Normal",   fontSize=9,  textColor=GRAY,  leading=12)
VALUE = style("Normal",   fontSize=10, textColor=DARK,  leading=14, fontName="Helvetica-Bold")
MONO  = style("Normal",   fontSize=9,  fontName="Courier", textColor=DARK, leading=13)

def hr(): return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB"), spaceAfter=8, spaceBefore=4)
def sp(h=6): return Spacer(1, h)

def section(title):
    return [sp(4), Paragraph(title, H2), hr()]

def kv_table(rows):
    data = [[Paragraph(k, LABEL), Paragraph(v, VALUE)] for k, v in rows]
    t = Table(data, colWidths=[4*cm, 12*cm])
    t.setStyle(TableStyle([
        ("VALIGN",    (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",(0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[WHITE, INDIGO_L]),
    ]))
    return t

def badge_table(items):
    data = [[Paragraph(f"✓ {i}", style("Normal", fontSize=9, textColor=INDIGO, fontName="Helvetica-Bold"))] for i in items]
    t = Table(data, colWidths=[16*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),INDIGO_L),
        ("TOPPADDING",(0,0),(-1,-1),3),
        ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),10),
        ("ROUNDEDCORNERS",[4,4,4,4]),
    ]))
    return t

# ── Documento ─────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    rightMargin=2*cm, leftMargin=2*cm,
    topMargin=2*cm,   bottomMargin=2*cm,
)

story = []

# ── Cabecera ──────────────────────────────────────────────────────────────────
story += [
    Paragraph("AgentWork", H1),
    Paragraph("On-Chain AI Task Marketplace on Arc Testnet", style("Normal", fontSize=13, textColor=GRAY, leading=16)),
    sp(2),
    Paragraph("The Stablecoins Commerce Stack Challenge · Track 4 — Best Agentic Economy Experience on Arc", SMALL),
    hr(),
]

# ── Datos de submission ───────────────────────────────────────────────────────
story += section("Submission Details")
story += [
    kv_table([
        ("Project Title",   "AgentWork — On-Chain AI Task Marketplace"),
        ("Track",           "Track 4 — Best Agentic Economy Experience on Arc"),
        ("Circle Account",  "xabier.sanmartin@gmail.com"),
        ("Circle Products", "USDC (escrow + auto-payment on Arc Testnet)"),
        ("GitHub",          "https://github.com/xam-dev-ux/agentwork"),
        ("Demo App",        "https://agentwork.vercel.app  (UI) · https://agentwork.onrender.com (Agent)"),
        ("Contract",        "0xb0548a2e387ff0162ada0903251385015c6cae45 (verified on ArcScan)"),
        ("Agent ERC-8004",  "https://testnet.8004scan.io/agents/0x8F058fE6b568D97f85d517Ac441b52B95722fDDe"),
    ]),
]

# ── Descripción ───────────────────────────────────────────────────────────────
story += section("Project Description")
story += [
    Paragraph(
        "AgentWork is an autonomous, on-chain AI task marketplace built on Arc Testnet. "
        "Users post natural language tasks with a USDC reward locked in a smart contract escrow. "
        "An autonomous AI agent (powered by Google Gemini) continuously polls the contract, "
        "claims available tasks, executes them using AI, and is paid automatically in USDC "
        "in the same <i>submitResult()</i> transaction — with no manual payment step.",
        BODY
    ),
    sp(4),
    Paragraph(
        "The payment flow is fully on-chain and trustless: USDC is locked at task creation and "
        "released directly to the agent upon result submission. The agent is registered on the "
        "ERC-8004 IdentityRegistry (Agent ID 17109), making it discoverable via 8004scan.io.",
        BODY
    ),
]

# ── Arquitectura ──────────────────────────────────────────────────────────────
story += section("Architecture Diagram")

arch_text = """
┌─────────────────────────────────────────────────────────────────┐
│                        USER (MetaMask)                          │
│                  Wallet: 0xc977...8DaF                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │  1. approve(contract, reward)
                            │  2. postTask(description, reward)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              AgentWork.sol  (Arc Testnet)                        │
│         0xb0548a2e387ff0162ada0903251385015c6cae45              │
│                                                                  │
│   taskId = taskCount++                                           │
│   USDC locked in contract via transferFrom()                     │
│   Task { id, poster, description, reward, state: Open }         │
└───────────────────────────┬─────────────────────────────────────┘
                            │  getAllTasks() — poll every 30s
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI Agent  (Render — Node.js / Express)             │
│         Wallet: 0x63F3b112F491b667d50A94a2693dE3Ac2BF564cF     │
│                                                                  │
│   3. claimTask(taskId)        → state: Claimed                  │
│   4. Gemini generateContent() → AI result string                │
│   5. submitResult(taskId, r)  → state: Completed                │
│                                 + usdc.transfer(agent, reward)  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  USDC auto-paid in same tx
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              USDC Token  (Arc Testnet)                          │
│         0x3600000000000000000000000000000000000000              │
└─────────────────────────────────────────────────────────────────┘

      ┌──────────────┐        ┌───────────────────────────┐
      │  Next.js UI  │        │  ERC-8004 IdentityRegistry│
      │  (Vercel)    │        │  Agent ID: 17109          │
      │  wagmi v2    │        │  testnet.8004scan.io      │
      └──────────────┘        └───────────────────────────┘
"""
story += [
    Paragraph(arch_text, CODE),
]

# ── Stack técnico ─────────────────────────────────────────────────────────────
story += section("Technical Stack")
story += [
    badge_table([
        "Smart Contract: Solidity 0.8.29, AgentWork.sol — escrow + auto-pay pattern",
        "Deploy: viem + solc (TypeScript) — private key never leaves the process",
        "AI Agent: Node.js + Express, Google Gemini 2.0 Flash, polling every 30s",
        "Frontend: Next.js 14 + wagmi v2 + Tailwind CSS — deployed on Vercel",
        "Infrastructure: Agent on Render free tier with self-ping keep-alive",
        "Agent Identity: ERC-8004 IdentityRegistry — registered on Arc Testnet",
    ]),
]

# ── Flujo USDC ────────────────────────────────────────────────────────────────
story += section("USDC Payment Flow (Trustless)")
story += [
    Paragraph("1. <b>approve()</b> — User authorizes contract to spend USDC", BODY),
    Paragraph("2. <b>postTask()</b> — USDC locked in AgentWork.sol via transferFrom()", BODY),
    Paragraph("3. <b>claimTask()</b> — Agent reserves the task (state → Claimed)", BODY),
    Paragraph("4. <b>Gemini AI</b> — Agent executes the task off-chain", BODY),
    Paragraph("5. <b>submitResult()</b> — Result stored on-chain + usdc.transfer(agent, reward) in same tx", BODY),
    sp(4),
    Paragraph(
        "No manual approval needed. The USDC payment is atomic with the result submission. "
        "If the agent fails to complete within 1 hour, the poster can call refund().",
        SMALL
    ),
]

# ── Contratos verificados ──────────────────────────────────────────────────────
story += section("Deployed & Verified Contracts on Arc Testnet")
story += [
    kv_table([
        ("AgentWork",   "0xb0548a2e387ff0162ada0903251385015c6cae45  ✓ Verified"),
        ("ArcToken ERC-20",  "0xfce439920abae395f2b9c05f3e263be996077fc6  ✓ Verified"),
        ("ArcNFT ERC-721",   "0xcc4a51615ead7f261f5eca25d3e6c1e20c4e9024  ✓ Verified"),
        ("ArcMulti ERC-1155","0xffc793fabb40b336f3334ca8307a93e466d5f324  ✓ Verified"),
        ("ArcAirdrop",       "0xa69f12f79d48c341c9cb58d8835323c03dde0688  ✓ Verified"),
    ]),
]

# ── Circle Product Feedback ───────────────────────────────────────────────────
story += section("Circle Product Feedback")
story += [
    Paragraph("<b>Why we chose USDC on Arc:</b>", BODY),
    Paragraph(
        "Arc's purpose-built L1 with USDC as the primary settlement token is the ideal environment "
        "for agentic payments. Deterministic finality and dollar-denominated fees eliminate the "
        "volatility risk that would make micro-payment escrows impractical on other chains.",
        BODY
    ),
    sp(4),
    Paragraph("<b>What worked well:</b>", BODY),
    Paragraph(
        "• USDC integration via standard ERC-20 interface was straightforward — no Circle SDK required for basic escrow.<br/>"
        "• Arc Testnet RPC was reliable throughout development with fast block times.<br/>"
        "• ArcScan (Blockscout-based) supported automated contract verification via API.<br/>"
        "• The ERC-8004 IdentityRegistry gave the agent a verifiable on-chain identity.",
        BODY
    ),
    sp(4),
    Paragraph("<b>What could be improved:</b>", BODY),
    Paragraph(
        "• The USDC testnet faucet has a low daily limit — higher limits would help stress-testing payment flows.<br/>"
        "• Arc documentation for ERC-8004 registration could include more TypeScript/viem examples.<br/>"
        "• A Circle-provided Nanopayments SDK for streaming per-task payments would fit the agentic economy track perfectly.",
        BODY
    ),
    sp(4),
    Paragraph("<b>Recommendations:</b>", BODY),
    Paragraph(
        "A Nanopayments primitive built into Arc would unlock real-time per-token or per-inference billing — "
        "the natural next step for AgentWork where agents could charge per character of output rather than a flat fee.",
        BODY
    ),
]

# ── Links ─────────────────────────────────────────────────────────────────────
story += section("Links")
story += [
    kv_table([
        ("GitHub",       "https://github.com/xam-dev-ux/agentwork"),
        ("UI (Vercel)",  "https://agentwork.vercel.app"),
        ("Agent",        "https://agentwork.onrender.com/health"),
        ("ArcScan",      "https://testnet.arcscan.app/address/0xb0548a2e387ff0162ada0903251385015c6cae45"),
        ("8004scan",     "https://testnet.8004scan.io/agents/0x8F058fE6b568D97f85d517Ac441b52B95722fDDe"),
        ("Video Demo",   "[ add your Loom / YouTube link here ]"),
    ]),
]

story += [sp(16), Paragraph("AgentWork · Stablecoins Commerce Stack Challenge 2026 · Track 4", SMALL)]

# ── Build ─────────────────────────────────────────────────────────────────────
doc.build(story)
print(f"✓ PDF generado: {OUTPUT}")
