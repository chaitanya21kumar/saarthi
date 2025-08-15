// backend/index.js  — webhook using Indian English voice
require('dotenv').config();
const express = require('express');
const { VoiceResponse } = require('twilio').twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));

app.all('/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const say = twiml.say({ voice: 'Polly.Aditi', language: 'en-IN' },
    'Namaste! This is '
    + '<phoneme alphabet="ipa" ph="saːrt̪ʰiː">Saarthi</phoneme>, '
    + 'your friendly E M I reminder demo.'
  );
  // Allow SSML inside <Say>:
  say.ssml = true; // Twilio parses SSML within Say text

  res.type('text/xml').send(twiml.toString());
});

app.listen(process.env.PORT || 3000, () => console.log('✅ TwiML server ready'));
