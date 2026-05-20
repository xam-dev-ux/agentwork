# AgentWork — Guía de despliegue paso a paso

> **Hackathon:** The Stablecoins Commerce Stack Challenge · Track 4: Agentic Economy  
> **Red:** Arc Testnet (Chain ID 5042002)  
> **USDC:** `0x3600000000000000000000000000000000000000`

---

## Seguridad de la clave privada

Tu clave privada **nunca sale de tu máquina ni del proceso**:

- `privateKeyToAccount(pk)` hace aritmética local secp256k1 — deriva la dirección pública sin enviar nada.
- `wallet.writeContract(...)` firma la transacción **en memoria** y solo envía la transacción firmada al RPC.
- La clave **nunca aparece en logs**, nunca se serializa, nunca viaja por red.
- `.env` está en `.gitignore` — nunca se sube a git.
- En Render, la clave se configura como variable de entorno en el dashboard, nunca en código.

---

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|----------------|
| Node.js     | 18 (usar `nvm use 22`) |
| npm         | 8+ |
| MetaMask    | Cualquier versión reciente |

Cuentas necesarias:
- Wallet EVM con algo de ETH en Arc Testnet (para gas) y USDC en Arc Testnet
- [Google AI Studio](https://aistudio.google.com/app/apikey) — API key gratuita (1500 req/día)
- [Vercel](https://vercel.com) — cuenta gratuita
- [Render](https://render.com) — cuenta gratuita

---

## Paso 1 — Instalar dependencias

```bash
# Usar Node 18+
nvm use 22

# Contrato (deploy)
cd agentwork/deploy
npm install

# Agente
cd ../agent
npm install

# UI
cd ../ui
npm install
```

---

## Paso 2 — Configurar variables del deploy

Crea `agentwork/deploy/.env` copiando el ejemplo:

```bash
cp agentwork/deploy/.env.example agentwork/deploy/.env
```

Edita `agentwork/deploy/.env`:

```env
# Tu clave privada EVM — solo para firmar txs localmente, nunca sale del proceso
PRIVATE_KEY=0xTU_CLAVE_PRIVADA_AQUI

# USDC en Arc Testnet (no cambiar)
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

> **Seguridad:** Este archivo está en `.gitignore`. Nunca lo subas a git.

---

## Paso 3 — Desplegar el contrato AgentWork

```bash
cd agentwork/deploy
npx tsx src/deploy.ts
```

Salida esperada:
```
Compilando AgentWork.sol...
✓ Compilado
Desplegando desde: 0xTU_DIRECCION
Tx enviada: 0x...
✓ AgentWork desplegado en: 0xDIRECCION_DEL_CONTRATO
  Explorer: https://testnet.arcscan.app/address/0xDIRECCION_DEL_CONTRATO

  Añade a tus .env:
  AGENT_WORK_ADDRESS=0xDIRECCION_DEL_CONTRATO
```

Guarda la dirección del contrato — la necesitarás en los pasos siguientes.

---

## Paso 4 — Configurar y lanzar el agente

### 4a. Crear `.env` del agente

```bash
cp agentwork/agent/.env.example agentwork/agent/.env
```

Edita `agentwork/agent/.env`:

```env
# Clave privada del agente (una wallet separada, con USDC para gas)
AGENT_PRIVATE_KEY=0xCLAVE_PRIVADA_DEL_AGENTE

# Dirección del contrato (del paso 3)
AGENT_WORK_ADDRESS=0xDIRECCION_DEL_CONTRATO

# USDC en Arc Testnet (no cambiar)
USDC_ADDRESS=0x3600000000000000000000000000000000000000

# Google AI Studio API Key
# Obtén la tuya en: https://aistudio.google.com/app/apikey
GOOGLE_AI_KEY=AIzaSy...

# URL pública en Render (completar después del paso 5)
RENDER_EXTERNAL_URL=
```

### 4b. Probar el agente localmente

```bash
cd agentwork/agent
npm run build
node dist/index.js
```

Verás:
```
AgentWork Agent corriendo en puerto 3001
Agente wallet: 0x...
Contrato:      0x...
Polling cada   30s
```

Verifica que funciona: `curl http://localhost:3001/health`

---

## Paso 5 — Desplegar el agente en Render

1. Sube el código a un repositorio GitHub (sin `.env`)
2. En [render.com](https://render.com) → **New Web Service**
3. Conecta el repositorio
4. Configura:
   - **Root Directory:** `agentwork/agent`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Plan:** Free

5. En **Environment** añade estas variables (nunca en el código):

   | Variable | Valor |
   |----------|-------|
   | `AGENT_PRIVATE_KEY` | `0x...` (tu clave privada del agente) |
   | `AGENT_WORK_ADDRESS` | `0x...` (del paso 3) |
   | `USDC_ADDRESS` | `0x3600000000000000000000000000000000000000` |
   | `GOOGLE_AI_KEY` | `AIzaSy...` |
   | `RENDER_EXTERNAL_URL` | Se completa después (paso 5b) |

6. **Deploy** — espera a que el build termine

7. Copia la URL pública de Render (ej: `https://agentwork-agent.onrender.com`)
8. Vuelve a **Environment** y añade:
   - `RENDER_EXTERNAL_URL` = `https://agentwork-agent.onrender.com`
9. **Re-deploy** (Manual Deploy)

> El agente hace self-ping cada 14 minutos para que Render free tier no duerma el servicio.

---

## Paso 6 — Registrar el agente en 8004scan.io (ERC-8004)

[8004scan.io](https://testnet.8004scan.io/) es el explorador de agentes IA basado en el estándar ERC-8004. Registrar el agente lo hace descubrible públicamente y es **requisito del hackathon** (Track 4: Agentic Economy).

El agente ya expone un endpoint `/metadata` con su ficha ERC-8004. Solo necesitas llamar al contrato `IdentityRegistry` una vez con la URL de ese endpoint.

### 6a. Verificar que el endpoint /metadata está activo

Una vez el agente está en Render (paso 5), comprueba que responde:

```bash
curl https://tu-agente.onrender.com/metadata
```

Deberías ver algo como:
```json
{
  "name": "AgentWork AI Agent",
  "description": "Autonomous AI agent that claims on-chain tasks...",
  "version": "1.0.0",
  "endpoints": [{ "protocol": "http", "url": "https://tu-agente.onrender.com/health" }],
  "payment": { "currency": "USDC", "network": "Arc Testnet", "address": "0x..." }
}
```

### 6b. Registrar en el IdentityRegistry

Desde `agentwork/deploy/`, ejecuta el script de registro con tu clave privada y la URL del agente:

```bash
cd agentwork/deploy

# Con la misma clave del agente (o la del deployer)
PRIVATE_KEY=0xTU_CLAVE_PRIVADA \
RENDER_EXTERNAL_URL=https://tu-agente.onrender.com \
npx tsx src/register8004.ts
```

Salida esperada:
```
Registrando agente en ERC-8004 IdentityRegistry...
  Wallet:      0x...
  MetadataURI: https://tu-agente.onrender.com/metadata
  Tx enviada:  0x...
  Esperando confirmación...

✓ Agente registrado en ERC-8004
  Agent ID:    42
  Explorer:    https://testnet.8004scan.io/agents/0x...
  ArcScan tx:  https://testnet.arcscan.app/tx/0x...
```

### 6c. Verificar en el explorador

Abre la URL del explorador que aparece en la salida:

```
https://testnet.8004scan.io/agents/0xDIRECCION_DEL_AGENTE
```

El agente aparecerá con nombre, descripción, skills y datos de pago en USDC.

> **Contratos ERC-8004 en Arc Testnet:**  
> IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`  
> Referencia: [docs.arc.io/arc/tutorials/register-your-first-ai-agent](https://docs.arc.io/arc/tutorials/register-your-first-ai-agent)

---

## Paso 7 — Desplegar la UI en Vercel

### 7a. Configurar `.env.local`

```bash
cp agentwork/ui/.env.example agentwork/ui/.env.local
```

Edita `agentwork/ui/.env.local`:

```env
NEXT_PUBLIC_AGENT_WORK_ADDRESS=0xDIRECCION_DEL_CONTRATO
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

### 7b. Probar localmente

```bash
cd agentwork/ui
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — deberías ver la UI con botón de conectar wallet.

### 7c. Desplegar en Vercel

1. Instala Vercel CLI (opcional): `npm i -g vercel`
2. En [vercel.com](https://vercel.com) → **New Project** → importa el repositorio
3. Configura:
   - **Root Directory:** `agentwork/ui`
   - **Framework Preset:** Next.js (detectado automáticamente)
4. En **Environment Variables** añade:
   - `NEXT_PUBLIC_AGENT_WORK_ADDRESS` = `0xDIRECCION_DEL_CONTRATO`
   - `NEXT_PUBLIC_USDC_ADDRESS` = `0x3600000000000000000000000000000000000000`
5. **Deploy**

---

## Paso 8 — Añadir Arc Testnet a MetaMask

En MetaMask → **Add Network** → **Add a network manually**:

| Campo | Valor |
|-------|-------|
| Network name | Arc Testnet |
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Currency symbol | ETH |
| Block explorer | `https://testnet.arcscan.app` |

---

## Paso 9 — Probar el flujo completo

1. Abre la UI en Vercel (o localhost:3000)
2. Conecta MetaMask (en Arc Testnet)
3. Asegúrate de tener USDC en Arc Testnet en tu wallet
4. Escribe una tarea y un reward (ej: "Translate to Spanish: Hello World" · 0.10 USDC)
5. Firma los dos pasos:
   - **Approve USDC** — autoriza al contrato a mover tu USDC
   - **Post Task** — bloquea el USDC en el contrato
6. El agente detecta la tarea en ~30 segundos, la reclama, la envía a Gemini y envía el resultado
7. El USDC va automáticamente a la wallet del agente

Puedes ver las transacciones en `https://testnet.arcscan.app/address/0xDIRECCION_DEL_CONTRATO`.

---

## Paso 10 — Registrar el proyecto en The Stablecoins Commerce Stack Challenge

**Plataforma:** [challenges.ignyte.ae](https://challenges.ignyte.ae/competition/4B436318-C737-F111-9A49-6045BD14D400)  
**Track:** 4 — Best Agentic Economy Experience on Arc (4 000 USDC 1º · 2 000 USDC 2º)  
**Deadline:** 13 de julio de 2026

---

### Tu wallet ya tiene huella on-chain permanente

Tu wallet deployer (`PRIVATE_KEY`) ha firmado estas transacciones en Arc Testnet — todas públicas, inmutables y verificables por el jurado sin que entregues ninguna clave:

| Transacción | Qué demuestra |
|-------------|---------------|
| Deploy de `AgentWork.sol` | Esa wallet creó el contrato escrow USDC en Arc |
| `register()` en IdentityRegistry ERC-8004 | El agente está registrado on-chain y aparece en `testnet.8004scan.io` |
| `claimTask()` por el agente | El agente operó de forma autónoma en Arc Testnet |
| `submitResult()` con pago USDC | El agente cobró USDC real on-chain de forma automática |

Enlace directo para el jurado:
```
https://testnet.arcscan.app/address/0xTU_WALLET_DEPLOYER
```

---

### Recopila estos datos antes de entrar al formulario

| Campo del form | Dónde encontrarlo |
|----------------|-------------------|
| **Track** | Track 4 — Best Agentic Economy Experience on Arc |
| **Circle Developer Account email** | El email con que te registraste en [console.circle.com](https://console.circle.com/signup) |
| **Circle products used** | USDC |
| **GitHub repo** | Tu repo público (sin `.env`) |
| **Demo video** | Grabación de 2-3 min (ver guión abajo) |
| **Demo app URL** | URL de Vercel (UI) |
| **Submission document** | PDF/PPTX/DOCX con la info del proyecto (ver plantilla abajo) |

---

### Guión del video demo (2-3 min)

1. Muestra el contrato en `testnet.arcscan.app` — ya desplegado con tu wallet
2. Abre la UI en Vercel, conecta MetaMask (Arc Testnet)
3. Post task: escribe una tarea y pon 0.10 USDC de reward — firma approve + postTask
4. Espera ~30s — el agente la detecta, la reclama y llama a Gemini
5. Refresca la UI — aparece el resultado generado por IA
6. Muestra en ArcScan la tx de `submitResult` donde el USDC va automáticamente al agente
7. Enseña el perfil del agente en `testnet.8004scan.io`

---

### Plantilla del submission document

Crea un PDF o DOCX con estas secciones (el formulario pide subir un archivo hasta 40 MB):

```
Título: AgentWork — On-Chain AI Task Marketplace

Track: 4 — Best Agentic Economy Experience on Arc

Descripción:
AgentWork es un mercado de tareas on-chain en Arc Testnet.
Los usuarios publican tareas con recompensa en USDC (bloqueado en escrow).
Un agente autónomo las detecta cada 30 s, las ejecuta con Gemini AI
y cobra el USDC automáticamente en la misma transacción submitResult().
No hay paso manual de pago — el contrato lo hace solo.

Flujo:
  postTask() → USDC bloqueado en AgentWork.sol
  claimTask() → tarea reservada al agente
  submitResult() → USDC transferido al agente automáticamente

Circle Products used:
  - USDC (escrow + auto-pago on-chain en Arc Testnet)

Stack:
  Smart contract: Solidity 0.8.20 (AgentWork.sol)
  Deploy/interacción: viem, TypeScript
  Agente backend: Node.js, Express, @google/generative-ai (Gemini 2.0 Flash)
  UI: Next.js 14, wagmi v2, Tailwind CSS
  Infra: Render (agente), Vercel (UI)
  Identidad del agente: ERC-8004 IdentityRegistry (testnet.8004scan.io)

Dirección del contrato: 0x...
Agente registrado en 8004scan: https://testnet.8004scan.io/agents/0x...
UI: https://agentwork.vercel.app

Diagrama de arquitectura:
  [incluir imagen: usuario → UI → AgentWork.sol ↔ USDC → agente → Gemini API]

Circle Product Feedback:
  Elegimos USDC en Arc porque permite escrow y auto-pago en la misma tx sin gas variable.
  Lo que funcionó bien: integración directa con viem, finality rápida, ArcScan claro.
  Mejoras sugeridas: faucet de USDC testnet con mayor límite diario;
  documentación de ERC-8004 más detallada en docs.arc.io.
```

---

### Checklist final antes de hacer Submit

- [ ] Cuenta en [console.circle.com](https://console.circle.com/signup) creada — anota el email
- [ ] Repo GitHub público con el código (sin `.env` — verificar con `git log -- "**/.env"`)
- [ ] Contrato visible en ArcScan (`testnet.arcscan.app/address/0xCONTRATO`)
- [ ] Agente activo en Render → `/health` responde OK
- [ ] Agente registrado en `testnet.8004scan.io`
- [ ] Al menos una tarea completada on-chain (tx `submitResult` visible en ArcScan)
- [ ] UI accesible en Vercel
- [ ] Video demo grabado y subido (YouTube unlisted / Loom)
- [ ] Documento PDF/PPTX preparado con la plantilla de arriba
- [ ] Entrar en [el formulario](https://challenges.ignyte.ae/competition/4B436318-C737-F111-9A49-6045BD14D400) → **Submit** → subir documento + links

---

## Estructura del proyecto

```
agentwork/
├── contracts/
│   └── AgentWork.sol          # Contrato Solidity (escrow + auto-pago)
├── deploy/
│   ├── src/deploy.ts          # Compila y despliega con viem
│   ├── src/register8004.ts    # Registra el agente en ERC-8004 IdentityRegistry
│   ├── .env.example
│   └── package.json
├── agent/
│   ├── src/index.ts           # Polling + Gemini + pago on-chain
│   ├── .env.example
│   └── package.json
├── ui/
│   ├── app/                   # Next.js 14 App Router
│   ├── components/            # TaskList, TaskCard, PostTaskForm, WalletButton
│   ├── lib/                   # contract.ts, wagmi.ts
│   ├── .env.example
│   └── package.json
└── SETUP.md                   # Este archivo
```

---

## Flujo de USDC (sin intermediarios)

```
Usuario  →  approve(contrato, reward)    →  USDC contract
Usuario  →  postTask(desc, reward)       →  USDC bloqueado en AgentWork
Agente   →  claimTask(id)               →  tarea reservada
Agente   →  submitResult(id, resultado) →  USDC transferido automáticamente al agente
```

El contrato llama a `usdc.transfer(agent, reward)` en el mismo `submitResult`. No hay paso manual de pago.

---

## Verificación de seguridad de la clave privada

| Punto de riesgo | Estado |
|-----------------|--------|
| `.env` en git | ✗ Bloqueado por `.gitignore` |
| Clave en logs | ✗ Ninguna línea de log imprime la clave |
| Clave en código fuente | ✗ Solo se lee de `process.env` |
| Clave enviada por red | ✗ `privateKeyToAccount()` hace firma local; solo la tx firmada viaja al RPC |
| Clave en Render dashboard | Solo la ves tú (propietario de la cuenta) |

La clave solo existe en RAM durante la ejecución del proceso. Si el proceso termina, desaparece.
