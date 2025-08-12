// Generate Twilio Access Token with proper capabilities for WebRTC

import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, identity } = req.body;

    if (!user_id || !identity) {
      return res.status(400).json({ 
        error: 'Missing required fields: user_id, identity' 
      });
    }

    // Create access token
    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity }
    );

    // Create Voice grant with calling capabilities
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
      pushCredentialSid: process.env.TWILIO_PUSH_CREDENTIAL_SID
    });

    accessToken.addGrant(voiceGrant);

    // Log token generation for audit
    await supabase
      .from('voice_commands')
      .insert({
        user_id,
        command_text: 'token_generated',
        action_type: 'authentication',
        status: 'processed',
        parsed_data: { identity, timestamp: new Date().toISOString() }
      });

    res.status(200).json({
      success: true,
      token: accessToken.toJwt(),
      identity,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate access token',
      details: error.message 
    });
  }
}