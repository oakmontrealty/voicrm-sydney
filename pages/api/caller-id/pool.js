import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Get all active phone numbers with usage statistics
      const { data: numbers, error } = await supabase
        .from('phone_numbers')
        .select(`
          *,
          assignments:caller_id_assignments(count),
          quality:call_quality_metrics(
            mos_score,
            meets_slo,
            created_at
          )
        `)
        .eq('is_active', true)
        .order('phone_number', { ascending: true })

      if (error) throw error

      // Calculate enhanced statistics for each number
      const enhancedNumbers = numbers.map(number => {
        const todayAssignments = number.assignments?.filter(a => 
          new Date(a.created_at).toDateString() === new Date().toDateString()
        ).length || 0

        const recentQuality = number.quality?.filter(q => 
          new Date(q.created_at) > new Date(Date.now() - 24*60*60*1000)
        ) || []

        const avgMOS = recentQuality.length > 0 ? 
          recentQuality.reduce((sum, q) => sum + (q.mos_score || 0), 0) / recentQuality.length : 0

        const sloCompliance = recentQuality.length > 0 ? 
          (recentQuality.filter(q => q.meets_slo).length / recentQuality.length) * 100 : 100

        return {
          ...number,
          todayUsage: todayAssignments,
          averageMOS: avgMOS,
          sloCompliance,
          status: determineNumberStatus(number, avgMOS, sloCompliance, todayAssignments)
        }
      })

      res.status(200).json({
        numbers: enhancedNumbers,
        lastUpdated: new Date().toISOString()
      })

    } catch (error) {
      console.error('Pool retrieval error:', error)
      res.status(500).json({ 
        error: 'Failed to retrieve phone number pool',
        details: error.message 
      })
    }

  } else if (req.method === 'POST') {
    // Add new number to pool
    try {
      const { phoneNumber, carrier, region = 'NSW' } = req.body

      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' })
      }

      // Add to pool
      const { data, error } = await supabase
        .from('phone_numbers')
        .insert({
          phone_number: phoneNumber,
          carrier: carrier || 'unknown',
          region,
          is_active: true,
          health_score: 1.0,
          usage_count: 0
        })

      if (error) throw error

      res.status(201).json({ success: true, data })

    } catch (error) {
      console.error('Pool addition error:', error)
      res.status(500).json({ 
        error: 'Failed to add number to pool',
        details: error.message 
      })
    }

  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}

function determineNumberStatus(number, avgMOS, sloCompliance, todayUsage) {
  if (avgMOS < 3.5 || sloCompliance < 80) return 'poor'
  if (todayUsage > 100) return 'overused'
  if (avgMOS > 4.0 && sloCompliance > 95) return 'excellent'
  return 'healthy'
}