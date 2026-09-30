// GetSalus: receives a meal photo + user profile, asks Gemini, returns JSON.
// The API key lives only in Netlify's environment variables (GEMINI_API_KEY).
exports.handler = async (event) => {
  const json = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST.' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: 'Server is missing its AI key.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request.' }); }
  if (!body.image) return json(400, { error: 'No photo received.' });

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt =
    'You are a friendly nutrition guide for everyday home meals (Indian food is common). Look at the meal photo. ' +
    'Do NOT push weight loss or restrictive eating. Give ranges, never false precision.\n' +
    'Eater profile: ' + JSON.stringify(body.profile || {}) + '\n' +
    'Respect their diet and allergies in every suggestion.\n' +
    'Return ONLY JSON: {"meal":"short name of the dishes","protein_g":"e.g. 20-25","energy_kcal":"e.g. 550-700",' +
    '"fibre":"low|moderate|high","key_nutrients":["max 3"],"good":"one sentence on what works, for this person",' +
    '"improve":"one sentence on the gap, for this person","additions":[{"emoji":"","name":"1-2 words"},{"emoji":"","name":""},{"emoji":"","name":""}]}. ' +
    'If the photo has no food, return {"error":"No food found in this photo."}';

  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: body.image } }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    if (r.status === 429) return json(429, { error: 'Daily free limit reached. Please try again later.' });
    if (!r.ok) return json(502, { error: 'AI service error (' + r.status + ').' });
    const data = await r.json();
    const text = data.candidates && data.candidates[0] && data.candidates[0].content.parts.map(p => p.text || '').join('');
    return json(200, JSON.parse((text || '{}').replace(/```json|```/g, '').trim()));
  } catch (e) {
    return json(500, { error: 'Could not analyse this photo.' });
  }
};
