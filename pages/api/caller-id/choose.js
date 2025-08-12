// Smart DID selection algorithm for optimal answer rates

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      agent_id, 
      contact_id, 
      to_number, 
      strategy = 'health_weighted' 
    } = req.body;

    // Validate required fields
    if (!agent_id || !to_number) {
      return res.status(400).json({ 
        error: 'Missing required fields: agent_id, to_number' 
      });
    }

    // Get available phone numbers based on strategy
    let numberQuery = supabase
      .from('phone_numbers')
      .select('*')
      .eq('status', 'active');

    // Apply selection strategy
    switch (strategy) {
      case 'random':
        break;
      
      case 'health_weighted':
        numberQuery = numberQuery
          .order('health_score', { ascending: false })
          .order('success_rate', { ascending: false })
          .order('last_used_at', { ascending: true });
        break;
      
      case 'least_recent':
        numberQuery = numberQuery
          .order('last_used_at', { ascending: true })
          .order('usage_count', { ascending: true });
        break;
      
      case 'geographic':
        const areaCode = to_number.substring(0, 5);
        numberQuery = numberQuery
          .order('area_code', { ascending: true })
          .order('health_score', { ascending: false });
        break;
    }

    const { data: availableNumbers, error: numberError } = await numberQuery.limit(5);

    if (numberError) {
      throw new Error(`Database error: ${numberError.message}`);
    }

    if (!availableNumbers || availableNumbers.length === 0) {
      return res.status(503).json({ 
        error: 'No available phone numbers in pool',
        suggestion: 'Contact administrator to provision more DIDs'
      });
    }

    // Select the best number based on strategy
    let selectedNumber;
    if (strategy === 'random') {
      selectedNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    } else {
      selectedNumber = availableNumbers[0];
    }

    // Check for team collision if contact_id provided
    let collisionWarning = null;
    if (contact_id) {
      const { data: recentContact, error: collisionError } = await supabase
        .from('contacts')
        .select('last_contacted_by, last_contact_date, profiles!contacts_last_contacted_by_fkey(full_name)')
        .eq('id', contact_id)
        .single();

      if (!collisionError && recentContact?.last_contact_date) {
        const hoursSinceContact = (new Date() - new Date(recentContact.last_contact_date)) / (1000 * 60 * 60);
        
        if (hoursSinceContact < 24 && recentContact.last_contacted_by !== agent_id) {
          collisionWarning = {
            message: `Contact was called ${Math.round(hoursSinceContact)} hours ago by ${recentContact.profiles?.full_name}`,
            lastContactBy: recentContact.last_contacted_by,
            lastContactDate: recentContact.last_contact_date,
            hoursAgo: Math.round(hoursSinceContact)
          };
        }
      }
    }

    // Record the assignment
    const { error: assignmentError } = await supabase
      .from('caller_id_assignments')
      .insert({
        agent_id,
        phone_number_id: selectedNumber.id,
        contact_id,
        strategy,
        from_number: selectedNumber.phone_number,
        to_number
      });

    if (assignmentError) {
      console.error('Assignment logging error:', assignmentError);
    }

    // Update usage statistics
    await supabase
      .from('phone_numbers')
      .update({
        usage_count: selectedNumber.usage_count + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedNumber.id);

    // Update contact last contacted info
    if (contact_id) {
      await supabase
        .from('contacts')
        .update({
          last_contacted_by: agent_id,
          last_contact_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', contact_id);
    }

    res.status(200).json({
      success: true,
      selectedNumber: {
        id: selectedNumber.id,
        phoneNumber: selectedNumber.phone_number,
        region: selectedNumber.region,
        healthScore: selectedNumber.health_score,
        strategy: strategy
      },
      collisionWarning,
      metadata: {
        totalAvailable: availableNumbers.length,
        usageCount: selectedNumber.usage_count + 1,
        lastUsed: selectedNumber.last_used_at
      }
    });

  } catch (error) {
    console.error('Caller ID selection error:', error);
    res.status(500).json({ 
      error: 'Failed to select caller ID',
      details: error.message 
    });
  }
}