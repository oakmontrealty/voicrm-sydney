import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Real estate specific coaching prompts
const COACHING_PROMPTS = {
  opening: `
    OPENING STAGE - First 2 minutes of call
    Focus: Build rapport, qualify need, understand timeline
    Key Questions: Why looking? When planning to move? Budget range?
    Avoid: Aggressive sales tactics, immediate property pushing
  `,
  
  discovery: `
    DISCOVERY STAGE - Understanding client needs
    Focus: Property requirements, location preferences, deal breakers
    Key Questions: Preferred suburbs? Must-have features? Family situation?
    Avoid: Overwhelming with options before understanding needs
  `,
  
  presentation: `
    PRESENTATION STAGE - Showing properties/solutions
    Focus: Match properties to stated needs, highlight value
    Key Questions: How does this fit your needs? What concerns you?
    Avoid: Generic descriptions, ignoring stated preferences
  `,
  
  handling_objection: `
    OBJECTION HANDLING - Address concerns directly
    Focus: Understand root concern, provide solutions, maintain rapport
    Key Techniques: Feel-felt-found, evidence-based responses
    Avoid: Arguing, dismissing concerns, high-pressure tactics
  `,
  
  closing: `
    CLOSING STAGE - Securing next steps
    Focus: Clear next actions, timeline, commitment level
    Key Questions: Ready to view? When suits for inspection? Any concerns?
    Avoid: Assumptive closes without buy-in, rushed decisions
  `
}

// Australian real estate objection responses
const OBJECTION_RESPONSES = {
  'too expensive': 'Price reflects market value - let me show you recent comparables in the area.',
  'need to think': 'I understand - what specific aspects would you like to discuss?',
  'want to see more': 'Great idea - I have 3 similar properties that might interest you.',
  'wrong location': 'Location is key - what areas are you most interested in?',
  'too small': 'Space is important - what\'s your ideal square meterage?',
  'not ready': 'No pressure - when were you hoping to make a move?'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = performance.now()
  
  try {
    const { transcript, callSid, contactId, propertyId, callStage = 'discovery' } = req.body
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript required' })
    }
    
    // Get context data
    const context = await gatherCallContext(contactId, propertyId, callSid)
    
    // Detect urgency and sentiment quickly
    const quickAnalysis = analyzeTranscriptQuick(transcript)
    
    // Generate coaching with timeout protection
    const coaching = await Promise.race([
      generateRealtimeCoaching(transcript, context, callStage, quickAnalysis),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 250)
      )
    ])
    
    const processingTime = performance.now() - startTime
    
    // Store analysis in database
    await supabase
      .from('ai_analysis')
      .insert({
        call_sid: callSid,
        contact_id: contactId,
        property_id: propertyId,
        analysis_type: 'real_time_coaching',
        analysis_result: {
          ...coaching,
          processingTime,
          transcript: transcript.slice(-200) // Store last 200 chars for context
        },
        processing_time_ms: processingTime,
        confidence: coaching.confidence
      })
    
    res.status(200).json({
      ...coaching,
      processingTime,
      targetMet: processingTime < 300
    })
    
  } catch (error) {
    const processingTime = performance.now() - startTime
    console.error('Coaching generation error:', error)
    
    // Return fallback coaching to maintain user experience
    const fallback = {
      tip: 'Continue active listening and ask open-ended questions',
      nextQuestion: 'What\'s most important to you in your next property?',
      urgency: 'low',
      sentiment: 'neutral',
      stage: callStage,
      confidence: 0.5,
      keywords: [],
      processingTime,
      fallback: true
    }
    
    res.status(200).json(fallback)
  }
}

async function gatherCallContext(contactId, propertyId, callSid) {
  const context = {}
  
  try {
    // Get contact information
    if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name, lead_score, status, notes, budget_min, budget_max')
        .eq('id', contactId)
        .single()
      
      context.contact = contact
    }
    
    // Get property information
    if (propertyId) {
      const { data: property } = await supabase
        .from('properties')
        .select('address, suburb, state, price, property_type, bedrooms, bathrooms')
        .eq('id', propertyId)
        .single()
      
      context.property = property
    }
    
    // Get recent call history for context
    if (callSid) {
      const { data: recentTranscripts } = await supabase
        .from('transcripts')
        .select('transcript_text, speaker')
        .eq('call_sid', callSid)
        .order('created_at', { ascending: false })
        .limit(5)
      
      context.recentTranscripts = recentTranscripts
    }
    
  } catch (error) {
    console.error('Context gathering error:', error)
  }
  
  return context
}

function analyzeTranscriptQuick(transcript) {
  const text = transcript.toLowerCase()
  
  // Quick sentiment detection
  const positiveWords = ['great', 'love', 'perfect', 'interested', 'yes', 'sounds good']
  const negativeWords = ['not interested', 'no', 'expensive', 'wrong', 'busy', 'later']
  const concernWords = ['worried', 'concerned', 'unsure', 'maybe', 'think about']
  
  let sentiment = 'neutral'
  let urgency = 'low'
  
  if (positiveWords.some(word => text.includes(word))) {
    sentiment = 'positive'
  } else if (negativeWords.some(word => text.includes(word))) {
    sentiment = 'negative'
    urgency = 'high'
  } else if (concernWords.some(word => text.includes(word))) {
    sentiment = 'concerned'
    urgency = 'medium'
  }
  
  // Detect objections
  const objections = []
  for (const [objection, response] of Object.entries(OBJECTION_RESPONSES)) {
    if (text.includes(objection.toLowerCase())) {
      objections.push({ objection, suggestedResponse: response })
    }
  }
  
  // Detect intent keywords
  const intentKeywords = []
  const keywords = {
    'buying': ['buy', 'purchase', 'looking for'],
    'selling': ['sell', 'selling', 'list my'],
    'viewing': ['see', 'look at', 'inspection', 'view'],
    'pricing': ['price', 'cost', 'budget', 'afford'],
    'timeline': ['when', 'timeline', 'moving', 'settle']
  }
  
  for (const [intent, words] of Object.entries(keywords)) {
    if (words.some(word => text.includes(word))) {
      intentKeywords.push(intent)
    }
  }
  
  return {
    sentiment,
    urgency,
    objections,
    intentKeywords,
    wordCount: transcript.split(' ').length
  }
}

async function generateRealtimeCoaching(transcript, context, stage, quickAnalysis) {
  try {
    // Build context-aware prompt
    const contextPrompt = buildContextPrompt(context, stage, quickAnalysis)
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Faster model for real-time
      messages: [
        {
          role: 'system',
          content: `You are an expert Australian real estate sales coach. Provide immediate, actionable coaching tips in under 250ms. Always respond in valid JSON format with no additional text.`
        },
        {
          role: 'user', 
          content: `${contextPrompt}\n\nLATEST TRANSCRIPT:\n"${transcript}"\n\nProvide coaching in this exact JSON format:\n{\n  "tip": "One specific action to take now (max 15 words)",\n  "nextQuestion": "Exact question to ask next",\n  "urgency": "low|medium|high",\n  "sentiment": "positive|neutral|negative|concerned", \n  "stage": "opening|discovery|presentation|handling_objection|closing",\n  "confidence": 0.85,\n  "keywords": ["key", "detected", "words"]\n}`
        }
      ],
      max_tokens: 200,
      temperature: 0.3,
      response_format: { type: "json_object" }\n    })\n    \n    const result = JSON.parse(completion.choices[0].message.content)\n    \n    // Enhance with objection handling if detected\n    if (quickAnalysis.objections.length > 0) {\n      result.objectionDetected = quickAnalysis.objections[0]\n      result.urgency = 'high'\n    }\n    \n    // Add stage-specific enhancements\n    result.stageGuidance = COACHING_PROMPTS[stage] || COACHING_PROMPTS.discovery\n    \n    return result\n    \n  } catch (error) {\n    console.error('GPT coaching error:', error)\n    \n    // Fallback to rule-based coaching\n    return generateFallbackCoaching(transcript, quickAnalysis, stage)\n  }\n}\n\nfunction buildContextPrompt(context, stage, quickAnalysis) {\n  let prompt = `STAGE: ${stage.toUpperCase()}\\n${COACHING_PROMPTS[stage]}\\n\\n`\n  \n  if (context.contact) {\n    prompt += `CLIENT: ${context.contact.first_name} ${context.contact.last_name}\\n`\n    prompt += `Lead Score: ${context.contact.lead_score}/10\\n`\n    prompt += `Status: ${context.contact.status}\\n`\n    if (context.contact.budget_min) {\n      prompt += `Budget: $${context.contact.budget_min.toLocaleString()} - $${context.contact.budget_max?.toLocaleString() || 'open'}\\n`\n    }\n  }\n  \n  if (context.property) {\n    prompt += `PROPERTY: ${context.property.address}\\n`\n    prompt += `Price: $${context.property.price?.toLocaleString()}\\n`\n    prompt += `Type: ${context.property.property_type} (${context.property.bedrooms}bed/${context.property.bathrooms}bath)\\n`\n  }\n  \n  if (quickAnalysis.objections.length > 0) {\n    prompt += `OBJECTION DETECTED: ${quickAnalysis.objections[0].objection}\\n`\n  }\n  \n  prompt += `SENTIMENT: ${quickAnalysis.sentiment}\\n`\n  prompt += `URGENCY: ${quickAnalysis.urgency}\\n`\n  \n  return prompt\n}\n\nfunction generateFallbackCoaching(transcript, quickAnalysis, stage) {\n  const text = transcript.toLowerCase()\n  \n  // Rule-based coaching for common scenarios\n  if (quickAnalysis.objections.length > 0) {\n    const objection = quickAnalysis.objections[0]\n    return {\n      tip: 'Address objection with empathy and evidence',\n      nextQuestion: 'What specifically concerns you about that?',\n      urgency: 'high',\n      sentiment: quickAnalysis.sentiment,\n      stage: 'handling_objection',\n      confidence: 0.7,\n      keywords: [objection.objection],\n      objectionResponse: objection.suggestedResponse\n    }\n  }\n  \n  // Stage-based fallbacks\n  const stageTips = {\n    opening: {\n      tip: 'Build rapport and understand their motivation',\n      nextQuestion: 'What\\'s prompting you to look for a new property?'\n    },\n    discovery: {\n      tip: 'Ask about location and property preferences',\n      nextQuestion: 'Which suburbs are you most interested in?'\n    },\n    presentation: {\n      tip: 'Highlight features that match their stated needs',\n      nextQuestion: 'How does this property fit what you\\'re looking for?'\n    },\n    closing: {\n      tip: 'Suggest specific next steps and timeline',\n      nextQuestion: 'When would suit you for an inspection?'\n    }\n  }\n  \n  const stageCoaching = stageTips[stage] || stageTips.discovery\n  \n  return {\n    ...stageCoaching,\n    urgency: quickAnalysis.urgency,\n    sentiment: quickAnalysis.sentiment,\n    stage,\n    confidence: 0.6,\n    keywords: quickAnalysis.intentKeywords,\n    fallback: true\n  }\n}