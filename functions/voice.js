// /voice — greet + gather (speech or any key) -> /analyze
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
      { voice: 'alice' },
      'Namaste! This is Saarthee, your E M I reminder demo. ' +
      'Please say how you feel about your upcoming payment, or press any key.'
    );
  
    // If no input in time, Twilio posts to /analyze because actionOnEmptyResult = true
    return callback(null, twiml);
  };
  