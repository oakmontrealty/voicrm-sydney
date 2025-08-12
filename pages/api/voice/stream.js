import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// WebSocket connections store
const connections = new Map()

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Handle Twilio Media Stream
    try {
      const { event, streamSid, callSid, tracks } = req.body

      switch (event) {
        case 'connected':
          console.log(`Media stream connected: ${streamSid}`)
          break

        case 'start':
          console.log(`Media stream started for call: ${callSid}`)
          // Initialize transcription session
          connections.set(streamSid, {
            callSid,
            audioBuffer: [],
            lastTranscript: '',
            startTime: Date.now()
          })
          break

        case 'media':
          // Process audio chunk
          if (req.body.media && req.body.media.payload) {
            await processAudioChunk(streamSid, req.body.media.payload)
          }
          break

        case 'stop':
          console.log(`Media stream stopped: ${streamSid}`)
          await finalizeTranscription(streamSid)
          connections.delete(streamSid)
          break
      }

      res.status(200).json({ success: true })

    } catch (error) {
      console.error('Stream processing error:', error)
      res.status(500).json({ error: error.message })
    }

  } else if (req.method === 'GET') {
    // WebSocket upgrade for real-time transcript delivery
    if (req.headers.upgrade === 'websocket') {
      // Handle WebSocket connection for browser clients
      handleWebSocketUpgrade(req, res)
    } else {
      // Get transcription status
      const { callSid } = req.query
      
      try {
        const { data: transcripts } = await supabase
          .from('transcripts')
          .select('*')
          .eq('call_sid', callSid)
          .order('created_at', { ascending: true })

        res.status(200).json({ transcripts })
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    }

  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

async function processAudioChunk(streamSid, audioPayload) {
  const connection = connections.get(streamSid)
  if (!connection) return

  try {
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioPayload, 'base64')
    connection.audioBuffer.push(audioBuffer)

    // Process every 2 seconds of audio (real-time chunks)
    if (connection.audioBuffer.length >= 40) { // ~2 seconds at 20 chunks/sec
      const combinedBuffer = Buffer.concat(connection.audioBuffer)
      connection.audioBuffer = []

      // Send to OpenAI Whisper for transcription
      const transcription = await openai.audio.transcriptions.create({
        file: new File([combinedBuffer], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
        language: 'en',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      })

      if (transcription.text && transcription.text.trim()) {
        // Store transcript chunk
        const { data: transcript } = await supabase
          .from('transcripts')
          .insert({
            call_sid: connection.callSid,
            speaker: 'caller', // Will enhance with speaker detection
            transcript_text: transcription.text,
            confidence: transcription.confidence || 0.9,
            start_time: (Date.now() - connection.startTime) / 1000,
            duration: 2.0
          })
          .select()
          .single()

        // Trigger AI analysis for coaching
        await generateRealtimeCoaching(connection.callSid, transcription.text)

        // Broadcast to connected WebSocket clients
        broadcastTranscript(connection.callSid, {
          speaker: 'caller',
          text: transcription.text,
          timestamp: new Date().toISOString(),
          confidence: transcription.confidence
        })
      }
    }

  } catch (error) {
    console.error('Audio processing error:', error)
  }
}

async function generateRealtimeCoaching(callSid, transcriptText) {
  try {
    // Get call context
    const { data: callLog } = await supabase
      .from('call_logs')
      .select(`
        *,
        contacts (
          first_name,
          last_name,
          lead_score,
          notes,
          status
        )
      `)
      .eq('call_sid', callSid)
      .single()

    if (!callLog) return

    // Generate AI coaching with GPT-4
    const prompt = `
    REAL ESTATE CALL COACHING - Respond in <300ms with actionable advice
    
    CONTEXT:
    - Client: ${callLog.contacts?.first_name} ${callLog.contacts?.last_name}
    - Lead Score: ${callLog.contacts?.lead_score}/10
    - Status: ${callLog.contacts?.status}
    - Notes: ${callLog.contacts?.notes}
    
    LATEST TRANSCRIPT:
    "${transcriptText}"
    
    Provide ONE immediate coaching tip focused on:
    1. Next best question to ask
    2. Objection handling if detected
    3. Appointment/offer timing if appropriate
    
    Keep response under 20 words, actionable, Australian real estate focused.
    `

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.3
    })

    const coaching = completion.choices[0]?.message?.content

    if (coaching) {
      // Store AI analysis
      await supabase
        .from('ai_analysis')
        .insert({
          call_sid: callSid,
          analysis_type: 'real_time_coaching',
          analysis_result: {
            coaching_tip: coaching,
            transcript_analyzed: transcriptText,
            confidence: 0.85
          },
          processing_time_ms: Date.now() - performance.now()
        })

      // Broadcast coaching to agent
      broadcastCoaching(callSid, {
        tip: coaching,
        urgency: detectUrgency(transcriptText),
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Coaching generation error:', error)
  }
}

function detectUrgency(text) {
  const urgentKeywords = ['not interested', 'busy', 'call back', 'thinking about it', 'need to discuss']
  const text_lower = text.toLowerCase()
  
  for (const keyword of urgentKeywords) {
    if (text_lower.includes(keyword)) {
      return 'high'
    }
  }
  
  return 'normal'
}

function broadcastTranscript(callSid, transcript) {
  // Broadcast to WebSocket clients (implement WebSocket server)
  console.log(`Broadcasting transcript for ${callSid}:`, transcript)
}

function broadcastCoaching(callSid, coaching) {
  // Broadcast coaching tip to agent interface
  console.log(`Broadcasting coaching for ${callSid}:`, coaching)
}

async function finalizeTranscription(streamSid) {
  const connection = connections.get(streamSid)
  if (!connection) return

  try {
    // Generate final call summary
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('*')
      .eq('call_sid', connection.callSid)
      .order('start_time', { ascending: true })

    if (transcripts && transcripts.length > 0) {
      const fullTranscript = transcripts.map(t => t.transcript_text).join(' ')
      
      // Generate comprehensive summary
      const summary = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: `Summarize this real estate call in 3 bullet points:
          
          ${fullTranscript}
          
          Include: main outcome, next actions, lead score 1-10`
        }],
        max_tokens: 150
      })

      // Store final analysis
      await supabase
        .from('ai_analysis')
        .insert({
          call_sid: connection.callSid,
          analysis_type: 'call_summary',
          analysis_result: {
            summary: summary.choices[0]?.message?.content,
            full_transcript: fullTranscript,
            duration_seconds: (Date.now() - connection.startTime) / 1000
          }
        })
    }

  } catch (error) {
    console.error('Finalization error:', error)
  }
}