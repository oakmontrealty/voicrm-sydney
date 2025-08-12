import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { contactId, agentId = 'current-agent' } = req.body

    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID required' })
    }

    // Check for recent interactions by other team members
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: recentInteractions, error } = await supabase
      .from('interactions')
      .select(`
        *,
        profiles:created_by (
          first_name,
          last_name,
          email
        )
      `)
      .eq('contact_id', contactId)
      .gte('created_at', twentyFourHoursAgo)
      .neq('created_by', agentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Check for recent calls specifically
    const { data: recentCalls, error: callsError } = await supabase
      .from('call_logs')
      .select(`
        *,
        profiles:agent_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq('contact_id', contactId)
      .gte('started_at', twentyFourHoursAgo)
      .neq('agent_id', agentId)
      .order('started_at', { ascending: false })

    if (callsError) throw callsError

    // Determine if there's a collision
    let collision = null
    
    if (recentInteractions && recentInteractions.length > 0) {
      const mostRecent = recentInteractions[0]
      const hoursAgo = Math.round((Date.now() - new Date(mostRecent.created_at).getTime()) / (1000 * 60 * 60))
      
      collision = {
        type: 'interaction',
        agent_name: `${mostRecent.profiles?.first_name} ${mostRecent.profiles?.last_name}`,
        agent_email: mostRecent.profiles?.email,
        hours_ago: hoursAgo,
        interaction_type: mostRecent.interaction_type,
        details: mostRecent.notes,
        timestamp: mostRecent.created_at,
        severity: hoursAgo < 2 ? 'high' : hoursAgo < 8 ? 'medium' : 'low'
      }
    }
    
    if (recentCalls && recentCalls.length > 0 && (!collision || new Date(recentCalls[0].started_at) > new Date(collision.timestamp))) {
      const mostRecentCall = recentCalls[0]
      const hoursAgo = Math.round((Date.now() - new Date(mostRecentCall.started_at).getTime()) / (1000 * 60 * 60))
      
      collision = {
        type: 'call',
        agent_name: `${mostRecentCall.profiles?.first_name} ${mostRecentCall.profiles?.last_name}`,
        agent_email: mostRecentCall.profiles?.email,
        hours_ago: hoursAgo,
        call_duration: mostRecentCall.duration,
        call_outcome: mostRecentCall.disposition,
        details: mostRecentCall.notes,
        timestamp: mostRecentCall.started_at,
        severity: hoursAgo < 1 ? 'high' : hoursAgo < 4 ? 'medium' : 'low'
      }
    }

    // Get contact context for better collision messaging
    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, last_name, phone_primary, lead_score, status')
      .eq('id', contactId)
      .single()

    res.status(200).json({
      collision,
      contact,
      recommendations: collision ? getCollisionRecommendations(collision) : null
    })

  } catch (error) {
    console.error('Collision check error:', error)
    res.status(500).json({ 
      error: 'Failed to check team collision',
      details: error.message 
    })
  }
}

function getCollisionRecommendations(collision) {
  const recommendations = []
  
  if (collision.severity === 'high') {
    recommendations.push('Consider coordinating with team member before calling')
    recommendations.push('Review previous interaction notes carefully')
    
    if (collision.type === 'call' && collision.call_duration) {
      recommendations.push('Previous call was substantial - check if follow-up was scheduled')
    }
  } else if (collision.severity === 'medium') {
    recommendations.push('Brief coordination may be helpful')
    recommendations.push('Consider mentioning previous team interaction')
  } else {
    recommendations.push('Previous interaction is not recent - proceed with caution')
  }
  
  return recommendations
}