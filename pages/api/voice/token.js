import { AccessToken } from 'twilio'

const { VoiceGrant } = AccessToken

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { identity } = req.body

    if (!identity) {
      return res.status(400).json({ error: 'Identity required' })
    }

    // Create access token
    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity }
    )

    // Create voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true
    })

    accessToken.addGrant(voiceGrant)

    // Set token expiry (1 hour)
    accessToken.ttl = 3600

    res.status(200).json({
      token: accessToken.toJwt(),
      identity,
      expires: new Date(Date.now() + 3600000).toISOString()
    })

  } catch (error) {
    console.error('Token generation error:', error)
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error.message 
    })
  }
}