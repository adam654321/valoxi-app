const apiKey = process.env.GOOGLE_GEMINI_API_KEY?.trim();
const model = 'gemini-2.5-flash-preview-04-17';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'Say "Valoxi API key works!" and nothing else.' }] }],
    generationConfig: { temperature: 0 },
  }),
});

const data = await res.json();
if (!res.ok) { console.error('❌', res.status, data.error?.message); process.exit(1); }
const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '(no response)';
console.log('✅ Response:', text.trim());
console.log('   Model:', model);
console.log('   Tokens used:', data.usageMetadata?.totalTokenCount);
