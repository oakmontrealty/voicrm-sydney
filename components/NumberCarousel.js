import { useState, useEffect } from 'react'
import { Phone, RotateCcw, Shield, TrendingUp } from 'lucide-react'

export default function NumberCarousel() {
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [selectedStrategy, setSelectedStrategy] = useState('random')
  const [currentCallerId, setCurrentCallerId] = useState(null)
  const [usage, setUsage] = useState({})
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadPhoneNumbers()
    loadUsageStats()
  }, [])
  
  const loadPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/caller-id/pool')
      const { numbers } = await response.json()
      setPhoneNumbers(numbers || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load phone numbers:', error)
      setLoading(false)
    }
  }
  
  const loadUsageStats = async () => {
    try {
      const response = await fetch('/api/caller-id/usage')
      const { stats } = await response.json()
      setUsage(stats || {})
    } catch (error) {
      console.error('Failed to load usage stats:', error)
    }
  }
  
  const selectOptimalNumber = async () => {
    try {
      const response = await fetch('/api/caller-id/choose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          strategy: selectedStrategy,
          destination: '+61412345678' // Default for demo
        })
      })
      
      const { callerId, reason } = await response.json()
      setCurrentCallerId({ number: callerId, reason })
      
    } catch (error) {
      console.error('Failed to select caller ID:', error)
    }
  }
  
  const formatAustralianNumber = (number) => {
    if (!number) return ''
    const digits = number.replace(/\D/g, '')
    
    if (digits.startsWith('61')) {
      const localPart = digits.slice(2)
      if (localPart.startsWith('2')) {
        return `+61 2 ${localPart.slice(1, 5)} ${localPart.slice(5)}`
      }
    }
    return number
  }
  
  const getStrategyIcon = (strategy) => {
    switch (strategy) {
      case 'random': return <RotateCcw className="h-4 w-4" />
      case 'health': return <TrendingUp className="h-4 w-4" />
      case 'least_used': return <Shield className="h-4 w-4" />
      default: return <Phone className="h-4 w-4" />
    }
  }
  
  if (loading) {
    return (
      <div className="voicrm-card p-4 animate-pulse">
        <div className="h-4 bg-oakmont-sage/20 rounded mb-3"></div>
        <div className="space-y-2">
          <div className="h-8 bg-oakmont-cream rounded"></div>
          <div className="h-8 bg-oakmont-cream rounded"></div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="voicrm-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-oakmont-sage">Number Carousel</h3>
        <span className="text-xs text-oakmont-grey">
          {phoneNumbers.length} Sydney DIDs
        </span>
      </div>
      
      {/* Strategy Selection */}
      <div className="mb-4">
        <label className="text-xs text-oakmont-grey mb-2 block">Caller ID Strategy</label>
        <select
          value={selectedStrategy}
          onChange={(e) => setSelectedStrategy(e.target.value)}
          className="w-full p-2 text-sm border border-oakmont-sage/20 rounded bg-white"
        >
          <option value="random">Random Selection</option>
          <option value="health">Health Weighted</option>
          <option value="least_used">Least Recently Used</option>
          <option value="geographic">Geographic Match</option>
        </select>
      </div>
      
      {/* Current Selection */}
      {currentCallerId && (
        <div className="mb-4 p-3 bg-oakmont-sage/10 rounded-lg border border-oakmont-sage/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-oakmont-grey">Selected Caller ID</span>
            <span className="text-xs text-oakmont-tan">{currentCallerId.reason}</span>
          </div>
          <div className="font-mono text-sm text-oakmont-black">
            {formatAustralianNumber(currentCallerId.number)}
          </div>
        </div>
      )}
      
      {/* Action Button */}
      <button
        onClick={selectOptimalNumber}
        className="w-full voicrm-btn-secondary text-sm flex items-center justify-center space-x-2"
      >
        {getStrategyIcon(selectedStrategy)}
        <span>Select Optimal DID</span>
      </button>
      
      {/* Usage Statistics */}
      <div className="mt-4 space-y-2">
        <h4 className="text-xs font-medium text-oakmont-sage">Today's Usage</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-oakmont-cream rounded">
            <div className="font-semibold text-oakmont-black">
              {usage.totalCalls || 0}
            </div>
            <div className="text-oakmont-grey">Total Calls</div>
          </div>
          <div className="text-center p-2 bg-oakmont-cream rounded">
            <div className="font-semibold text-oakmont-black">
              {(usage.answerRate || 0).toFixed(1)}%
            </div>
            <div className="text-oakmont-grey">Answer Rate</div>
          </div>
        </div>
      </div>
      
      {/* DID Pool Status */}
      <div className="mt-4">
        <h4 className="text-xs font-medium text-oakmont-sage mb-2">DID Pool Health</h4>
        <div className="space-y-1">
          {phoneNumbers.slice(0, 3).map(number => (
            <div key={number.id} className="flex items-center justify-between text-xs">
              <span className="text-oakmont-grey font-mono">
                {formatAustralianNumber(number.phone_number).slice(-8)}
              </span>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  number.health_score >= 0.8 ? 'bg-green-500' :
                  number.health_score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className="text-oakmont-grey">
                  {(number.health_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
          {phoneNumbers.length > 3 && (
            <div className="text-xs text-oakmont-grey text-center pt-1">
              +{phoneNumbers.length - 3} more numbers
            </div>
          )}
        </div>
      </div>
    </div>
  )
}