import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Sydney SLO targets
const SLO_TARGETS = {
  mos: 4.2,        // Minimum MOS score
  latency: 150,    // Maximum latency in ms
  jitter: 20,      // Maximum jitter in ms
  packetLoss: 1.0  // Maximum packet loss percentage
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Store quality metrics
    try {
      const { 
        call_sid, 
        mos_score, 
        latency, 
        jitter, 
        packet_loss, 
        timestamp 
      } = req.body

      // Validate SLOs
      const sloViolations = []
      
      if (mos_score && mos_score < SLO_TARGETS.mos) {
        sloViolations.push(`MOS below target: ${mos_score} < ${SLO_TARGETS.mos}`)
      }
      
      if (latency && latency > SLO_TARGETS.latency) {
        sloViolations.push(`Latency above target: ${latency}ms > ${SLO_TARGETS.latency}ms`)
      }
      
      if (jitter && jitter > SLO_TARGETS.jitter) {
        sloViolations.push(`Jitter above target: ${jitter}ms > ${SLO_TARGETS.jitter}ms`)
      }
      
      if (packet_loss && packet_loss > SLO_TARGETS.packetLoss) {
        sloViolations.push(`Packet loss above target: ${packet_loss}% > ${SLO_TARGETS.packetLoss}%`)
      }

      // Store metrics in database
      const { data, error } = await supabase
        .from('call_quality_metrics')
        .insert({
          call_sid,
          mos_score: mos_score || null,
          latency: latency || null,
          jitter: jitter || null,
          packet_loss: packet_loss || null,
          slo_violations: sloViolations.length > 0 ? sloViolations : null,
          meets_slo: sloViolations.length === 0,
          carrier_detected: null, // Can be enhanced with carrier detection
          created_at: timestamp || new Date().toISOString()
        })

      if (error) throw error

      // If SLO violations detected, potentially alert
      if (sloViolations.length > 0) {
        console.warn(`SLO violations for call ${call_sid}:`, sloViolations)
        
        // Could integrate with alerting system here
        // await sendSlackAlert(call_sid, sloViolations)
      }

      res.status(200).json({ 
        success: true,
        sloViolations,
        meetsSlo: sloViolations.length === 0,
        targets: SLO_TARGETS
      })

    } catch (error) {
      console.error('Quality storage error:', error)
      res.status(500).json({ 
        error: 'Failed to store quality metrics',
        details: error.message 
      })
    }
    
  } else if (req.method === 'GET') {
    // Get quality statistics
    try {
      const { timeframe = '24h', call_sid } = req.query
      
      let query = supabase.from('call_quality_metrics').select('*')
      
      if (call_sid) {
        query = query.eq('call_sid', call_sid)
      } else {
        // Time-based filtering
        const hoursBack = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : 168 // 1 week
        const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
        query = query.gte('created_at', startTime)
      }
      
      const { data: metrics, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Calculate aggregated statistics
      const stats = {
        totalCalls: metrics.length,
        averageMOS: 0,
        averageLatency: 0,
        averageJitter: 0,
        averagePacketLoss: 0,
        sloCompliance: 0,
        violationCount: 0
      }
      
      if (metrics.length > 0) {
        const validMOS = metrics.filter(m => m.mos_score).map(m => m.mos_score)
        const validLatency = metrics.filter(m => m.latency).map(m => m.latency)
        const validJitter = metrics.filter(m => m.jitter).map(m => m.jitter)
        const validPacketLoss = metrics.filter(m => m.packet_loss).map(m => m.packet_loss)
        
        stats.averageMOS = validMOS.length > 0 ? 
          validMOS.reduce((sum, val) => sum + val, 0) / validMOS.length : 0
          
        stats.averageLatency = validLatency.length > 0 ? 
          validLatency.reduce((sum, val) => sum + val, 0) / validLatency.length : 0
          
        stats.averageJitter = validJitter.length > 0 ? 
          validJitter.reduce((sum, val) => sum + val, 0) / validJitter.length : 0
          
        stats.averagePacketLoss = validPacketLoss.length > 0 ? 
          validPacketLoss.reduce((sum, val) => sum + val, 0) / validPacketLoss.length : 0
        
        const sloCompliant = metrics.filter(m => m.meets_slo).length
        stats.sloCompliance = (sloCompliant / metrics.length) * 100
        stats.violationCount = metrics.length - sloCompliant
      }
      
      res.status(200).json({
        success: true,
        timeframe,
        statistics: stats,
        metrics: metrics.slice(0, 100), // Return latest 100 metrics
        sloTargets: SLO_TARGETS
      })
      
    } catch (error) {
      console.error('Quality retrieval error:', error)
      res.status(500).json({ 
        error: 'Failed to retrieve quality metrics',
        details: error.message 
      })
    }
    
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}