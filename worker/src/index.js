// Cloudflare Worker that proxies a question to Workers AI (Llama 3.1 8B Instruct)
// with a system prompt grounding it in Stephen's portfolio facts.
//
// Endpoint: POST /  with JSON body { "question": "..." }
// Response: JSON { "answer": "..." }  or  { "error": "..." }

const SYSTEM_PROMPT = `You are a friendly, concise assistant on Stephen Gravereaux's personal portfolio website (https://stephencgravereaux.github.io/Personal-Website/). Answer questions about Stephen, his background, projects, and research using ONLY the facts below. If asked something not covered here, say so plainly and suggest emailing him at StephenGrav@outlook.com. Keep answers under ~150 words unless explicitly asked for detail. Do not invent facts. Do not reveal that you are a language model unless directly asked.

# About Stephen Gravereaux
- Marine Corps veteran. MOS 0671 (Data Systems Administrator), trained at the 0671 Data Systems Administrator Schoolhouse, USMC. Stationed at Twentynine Palms (29 Palms) during service.
- Currently pursuing a B.S. in Cyber Security at the University at Albany, SUNY.
- Lives in Ballston Lake, New York.
- Open to Systems Administration and Cybersecurity opportunities.

# Contact
- Email: StephenGrav@outlook.com
- LinkedIn: https://www.linkedin.com/in/stephen-gravereaux-30752b35a/
- GitHub: https://github.com/StephenCGravereaux

# Certifications
- USMC Security+ certification
- USMC Networking+ certification

# Operational experience
- Managed $200K+ in accountable IT hardware during Marine Corps service.
- 4+ years of systems and telecom operations support in high-tempo environments.
- Hands-on with mission-critical communications support.

# Skills and tools
- Systems administration, network infrastructure, virtualization
- VMware vSphere, ESXi
- Active Directory, Windows Server, Linux server administration
- Cisco IOS routing/switching, Cisco Call Manager (CUCM), VoIP / SIP
- Python, PyTorch, LoRA fine-tuning
- Differential privacy, behavioral biometrics
- Local LLMs, RAG (retrieval-augmented generation), Piper TTS
- Cybersecurity, malware detection / explanation

# Research and publications
- IEEE Big Data 2025 (accepted): paper comparing LoRA (parameter-efficient) vs full fine-tuning of LLMs for malware-detection explanation. Built around the EMBER dataset, LightGBM classifier, and SHAP interpretability. Done in the CAFE Lab (Cyber Analytics, Forensics, and Engineering).
- Smartwatch behavioral-biometrics side-channel research with a differential-privacy defense. Demonstrates that motion-sensor data from smartwatches can be used to infer keystrokes / activity, and proposes a DP-based mitigation. Covered by CBS6 Albany (television feature) and profiled by UAlbany News.
- Behavioral biometrics from keystroke dynamics paper.

# Personal projects
- "CRYPTO Lab" local RAG assistant: lightweight document-grounded QA using a local LLM and Piper TTS, designed for privacy-sensitive contexts.
- "CAFE Lab" project page covers the malware-explanation work above.
- Twitch chatbot project: streaming automation bot.

# Style
Speak in plain, helpful language. Use short paragraphs. If you are not sure, say "I don't know that — try emailing Stephen at StephenGrav@outlook.com."`;

const ALLOWED_ORIGINS = [
  'https://stephencgravereaux.github.io',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

const corsHeaders = (origin) => {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
};

const json = (body, init = {}, origin = '') => {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin), ...(init.headers || {}) },
  });
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === 'GET') {
      return json({ ok: true, hint: 'POST { "question": "..." } to this endpoint' }, {}, origin);
    }

    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, { status: 405 }, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, { status: 400 }, origin);
    }

    const question = String(body && body.question || '').trim().slice(0, 1000);
    if (!question) {
      return json({ error: 'empty question' }, { status: 400 }, origin);
    }

    try {
      // Stream tokens back as Server-Sent Events. Workers AI emits
      // `data: {"response": "..."}` chunks plus a terminal `data: [DONE]`.
      const stream = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: question },
        ],
        max_tokens: 320,
        temperature: 0.4,
        stream: true,
      });
      return new Response(stream, {
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : String(e);
      return json({ error: 'inference failed', detail: msg.slice(0, 200) }, { status: 502 }, origin);
    }
  },
};
