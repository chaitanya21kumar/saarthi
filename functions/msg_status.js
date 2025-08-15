// /msg_status — delivery/debug logs for WA
exports.handler = async function (context, event, callback) {
    try {
      console.log('[msg_status]',
        'Sid=', event.MessageSid,
        'Status=', event.MessageStatus,
        'ErrorCode=', event.ErrorCode || '',
        'To=', event.To);
    } catch {}
    return callback(null, 'ok');
  };
  