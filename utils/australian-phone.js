// Australian phone number validation and formatting utilities
// Compliant with ACMA numbering plan and Privacy Act 1988

export class AustralianPhoneValidator {
  
  // Valid Australian area codes and mobile prefixes
  static AREA_CODES = {
    '02': 'NSW/ACT',
    '03': 'VIC/TAS', 
    '07': 'QLD',
    '08': 'SA/WA/NT'
  }
  
  static MOBILE_PREFIXES = ['04', '05']
  
  static SPECIAL_NUMBERS = {
    '13': 'National rate',
    '1300': 'Local rate',
    '1800': 'Toll free',
    '1900': 'Premium rate'
  }
  
  /**
   * Validate Australian phone number
   * @param {string} number - Phone number to validate
   * @returns {object} Validation result with details
   */
  static validate(number) {
    if (!number) {
      return { isValid: false, error: 'Number required' }
    }
    
    // Clean input
    const cleaned = number.replace(/\s+/g, '').replace(/[^\d+]/g, '')
    const digits = cleaned.replace(/\+/g, '').replace(/^61/, '')
    
    // Check length
    if (digits.length < 8 || digits.length > 10) {
      return { isValid: false, error: 'Invalid length' }
    }
    
    // Determine number type
    const type = this.getNumberType(digits)
    
    if (type === 'invalid') {
      return { isValid: false, error: 'Invalid Australian number format' }
    }
    
    return {
      isValid: true,
      type,
      formatted: this.format(cleaned),
      international: this.toInternational(cleaned),
      carrier: this.detectCarrier(digits),
      region: this.getRegion(digits)
    }
  }
  
  /**
   * Format Australian number for display
   * @param {string} number - Raw phone number
   * @returns {string} Formatted number
   */
  static format(number) {
    const digits = number.replace(/\D/g, '')
    let localDigits = digits
    
    // Handle international format
    if (digits.startsWith('61')) {
      localDigits = '0' + digits.slice(2)
    }
    
    // Mobile numbers: 04XX XXX XXX
    if (localDigits.startsWith('04') || localDigits.startsWith('05')) {
      return `${localDigits.slice(0, 4)} ${localDigits.slice(4, 7)} ${localDigits.slice(7)}`
    }
    
    // Landlines: 0X XXXX XXXX
    if (localDigits.startsWith('0') && localDigits.length === 10) {
      return `${localDigits.slice(0, 2)} ${localDigits.slice(2, 6)} ${localDigits.slice(6)}`
    }
    
    // Special numbers
    if (localDigits.startsWith('13') || localDigits.startsWith('18')) {
      return localDigits.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')
    }
    
    return number
  }
  
  /**
   * Convert to international format
   * @param {string} number - Australian phone number
   * @returns {string} International format (+61...)
   */
  static toInternational(number) {
    const digits = number.replace(/\D/g, '')
    
    if (digits.startsWith('61')) {
      return '+' + digits
    }
    
    if (digits.startsWith('0')) {
      return '+61' + digits.slice(1)
    }
    
    return '+61' + digits
  }
  
  /**
   * Determine number type
   * @param {string} digits - Clean digits
   * @returns {string} Number type
   */
  static getNumberType(digits) {
    // Remove leading 0 for analysis
    const withoutLeading = digits.startsWith('0') ? digits.slice(1) : digits
    
    if (withoutLeading.startsWith('4') || withoutLeading.startsWith('5')) {
      return 'mobile'
    }
    
    if (['2', '3', '7', '8'].includes(withoutLeading[0])) {
      return 'landline'
    }
    
    if (withoutLeading.startsWith('13') || withoutLeading.startsWith('1300')) {
      return 'national'
    }
    
    if (withoutLeading.startsWith('1800')) {
      return 'toll_free'
    }
    
    if (withoutLeading.startsWith('1900')) {
      return 'premium'
    }
    
    return 'invalid'
  }
  
  /**
   * Detect carrier (basic implementation)
   * @param {string} digits - Phone number digits
   * @returns {string} Likely carrier
   */
  static detectCarrier(digits) {
    // This is a simplified detection - would need API integration for accuracy
    const mobile = digits.startsWith('0') ? digits.slice(1) : digits
    
    if (mobile.startsWith('4')) {
      // Mobile number - basic range detection
      const prefix = mobile.slice(0, 3)
      
      // Telstra ranges (approximate)
      if (['400', '401', '402', '403', '404', '405', '406', '407', '408', '409'].includes(prefix)) {
        return 'Telstra'
      }
      
      // Optus ranges (approximate)  
      if (['410', '411', '412', '413', '414', '415', '416', '417', '418', '419'].includes(prefix)) {
        return 'Optus'
      }
      
      // Vodafone ranges (approximate)
      if (['420', '421', '422', '423', '424', '425', '426', '427', '428', '429'].includes(prefix)) {
        return 'Vodafone'
      }
    }
    
    return 'Unknown'
  }
  
  /**
   * Get geographic region
   * @param {string} digits - Phone number digits  
   * @returns {string} Region
   */
  static getRegion(digits) {
    const withoutLeading = digits.startsWith('0') ? digits.slice(1) : digits
    
    if (withoutLeading.startsWith('2')) return 'NSW/ACT'
    if (withoutLeading.startsWith('3')) return 'VIC/TAS'
    if (withoutLeading.startsWith('7')) return 'QLD'  
    if (withoutLeading.startsWith('8')) return 'SA/WA/NT'
    if (withoutLeading.startsWith('4') || withoutLeading.startsWith('5')) return 'Mobile'
    
    return 'Unknown'
  }
  
  /**
   * Check if number is likely to have good answer rates
   * @param {string} number - Phone number
   * @returns {object} Answer rate analysis
   */
  static analyzeAnswerRate(number) {
    const validation = this.validate(number)
    
    if (!validation.isValid) {
      return { score: 0, factors: ['Invalid number'] }
    }
    
    const factors = []
    let score = 50 // Base score
    
    // Mobile numbers generally have better answer rates
    if (validation.type === 'mobile') {
      score += 20
      factors.push('Mobile number (+20)')
    }
    
    // NSW/Sydney numbers for local real estate
    if (validation.region === 'NSW/ACT') {
      score += 15
      factors.push('NSW region match (+15)')
    }
    
    // Telstra generally has better coverage
    if (validation.carrier === 'Telstra') {
      score += 10
      factors.push('Telstra network (+10)')
    }
    
    // Modern number formats
    if (!validation.formatted.includes('13') && !validation.formatted.includes('18')) {
      score += 5
      factors.push('Standard format (+5)')
    }
    
    return {
      score: Math.min(score, 100),
      factors,
      recommendation: score >= 70 ? 'high_priority' : score >= 50 ? 'normal' : 'low_priority'
    }
  }
  
  /**
   * Generate caller ID suggestion for optimal answer rates
   * @param {string} destinationNumber - Number being called
   * @param {array} availableCallerIds - Available caller ID numbers
   * @returns {object} Optimal caller ID selection
   */
  static suggestCallerIdForAnswerRate(destinationNumber, availableCallerIds) {
    const destValidation = this.validate(destinationNumber)
    
    if (!destValidation.isValid) {
      return { error: 'Invalid destination number' }
    }
    
    // Score each available caller ID
    const scoredCallerIds = availableCallerIds.map(callerId => {
      const callerValidation = this.validate(callerId.phone_number)
      let score = 50
      
      // Same region matching
      if (callerValidation.region === destValidation.region) {
        score += 30
      }
      
      // Same carrier preference  
      if (callerValidation.carrier === destValidation.carrier) {
        score += 20
      }
      
      // Mobile to mobile preference
      if (destValidation.type === 'mobile' && callerValidation.type === 'mobile') {
        score += 15
      }
      
      // Recent usage penalty
      const hoursAgo = callerId.last_used ? 
        (Date.now() - new Date(callerId.last_used).getTime()) / (1000 * 60 * 60) : 24
      
      if (hoursAgo < 1) score -= 20
      else if (hoursAgo < 4) score -= 10
      
      return {
        ...callerId,
        score,
        reasons: this.getSelectionReasons(callerValidation, destValidation, hoursAgo)
      }
    })
    
    // Return highest scoring caller ID
    const optimal = scoredCallerIds.reduce((best, current) => 
      current.score > best.score ? current : best
    )
    
    return {
      recommended: optimal,
      allOptions: scoredCallerIds.sort((a, b) => b.score - a.score),
      strategy: 'answer_rate_optimized'
    }
  }
  
  static getSelectionReasons(caller, destination, hoursAgo) {
    const reasons = []
    
    if (caller.region === destination.region) {
      reasons.push(`Same region (${caller.region})`)
    }
    
    if (caller.carrier === destination.carrier) {
      reasons.push(`Same carrier (${caller.carrier})`)
    }
    
    if (hoursAgo >= 4) {
      reasons.push('Well-rested number')
    }
    
    return reasons
  }
}

// Export utilities for API usage
export const validateAustralianPhone = AustralianPhoneValidator.validate
export const formatAustralianPhone = AustralianPhoneValidator.format
export const toInternationalFormat = AustralianPhoneValidator.toInternational