// /voice — greet + gather (speech or DTMF) -> /analyze
exports.handler = async function (context, event, callback) {
    const twiml = new Twilio.twiml.VoiceResponse();
    const analyzeUrl = `https://${context.DOMAIN_NAME}/analyze`;
  
    const g = twiml.gather({
      input: 'speech dtmf',
      action: analyzeUrl,
      method: 'POST',
      timeout: 6,
      speechTimeout: 'auto',
      numDigits: 1,
      actionOnEmptyResult: true
    });
  
    g.say(
      { voice: 'Polly.Aditi', language: 'en-IN' },
      'Namaste. This is Saarthi—your friendly E M I reminder. '
      + 'You can say “I want to pay” or “I need more time”. '
      + 'Or press 1 to pay now, press 2 to request more time, press 3 if you cannot pay.'
    );
  
    return callback(null, twiml);
  };
  