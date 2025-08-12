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
    const { strategy = 'random', destination, agentId = 'default' } = req.body

    // Get available phone numbers
    const { data: numbers, error: numbersError } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('is_active', true)
      .eq('region', 'NSW')

    if (numbersError) throw numbersError

    if (!numbers || numbers.length === 0) {
      return res.status(404).json({ error: 'No available phone numbers' })
    }

    let selectedNumber
    let reason

    switch (strategy) {
      case 'random':
        selectedNumber = numbers[Math.floor(Math.random() * numbers.length)]
        reason = 'Random selection for optimal distribution'
        break

      case 'health':
        // Select number with highest health score
        selectedNumber = numbers.reduce((best, current) => 
          (current.health_score || 0) > (best.health_score || 0) ? current : best
        )
        reason = `Health-weighted selection (${(selectedNumber.health_score * 100).toFixed(0)}% health)`
        break

      case 'least_used':
        // Get usage stats for today
        const today = new Date().toISOString().split('T')[0]
        const { data: usageStats } = await supabase
          .from('caller_id_assignments')
          .select('phone_number_id, count(*)')
          .gte('created_at', today + 'T00:00:00Z')
          .group('phone_number_id')

        // Find least used number
        const usageMap = {}
        usageStats?.forEach(stat => {
          usageMap[stat.phone_number_id] = stat.count
        })

        selectedNumber = numbers.reduce((least, current) => {
          const currentUsage = usageMap[current.id] || 0
          const leastUsage = usageMap[least.id] || 0
          return currentUsage < leastUsage ? current : least
        })
        
        reason = `Least used today (${usageMap[selectedNumber.id] || 0} calls)`
        break

      case 'geographic':
        // Try to match area code (basic implementation)
        const destinationArea = destination?.slice(-10, -8) // Get area from number
        const matchingArea = numbers.find(num => 
          num.phone_number.includes(destinationArea)
        )
        
        selectedNumber = matchingArea || numbers[0]
        reason = matchingArea ? 'Geographic area match' : 'No area match, using default'
        break

      default:
        selectedNumber = numbers[0]
        reason = 'Default selection'
    }

    // Log the assignment
    await supabase
      .from('caller_id_assignments')
      .insert({
        phone_number_id: selectedNumber.id,
        agent_id: agentId,
        destination_number: destination,
        strategy_used: strategy,
        assignment_reason: reason
      })

    // Update usage stats
    await supabase
      .from('phone_numbers')
      .update({ 
        last_used: new Date().toISOString(),
        usage_count: (selectedNumber.usage_count || 0) + 1
      })
      .eq('id', selectedNumber.id)

    res.status(200).json({
      callerId: selectedNumber.phone_number,
      numberId: selectedNumber.id,
      strategy,
      reason,
      healthScore: selectedNumber.health_score,
      carrier: selectedNumber.carrier
    })

  } catch (error) {
    console.error('Caller ID selection error:', error)
    res.status(500).json({ 
      error: 'Failed to select caller ID',
      details: error.message 
    })
  }
}