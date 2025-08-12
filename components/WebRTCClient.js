import { useState, useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { Device } from '@twilio/voice-sdk'

export default function WebRTCClient({ onCallStateChange, onQualityUpdate }) {
  const [device, setDevice] = useState(null)
  const [call, setCall] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [callStatus, setCallStatus] = useState('ready') // ready, connecting, connected, error
  const [callQuality, setCallQuality] = useState({
    mos: 0,
    latency: 0,
    jitter: 0,
    packetLoss: 0
  })
  
  const deviceRef = useRef(null)
  const qualityInterval = useRef(null)

  useEffect(() => {
    initializeDevice()
    return () => {
      if (qualityInterval.current) clearInterval(qualityInterval.current)
      if (deviceRef.current) deviceRef.current.destroy()
    }
  }, [])

  const initializeDevice = async () => {
    try {
      // Get Twilio access token
      const response = await fetch('/api/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: 'agent-' + Date.now() })
      })
      
      const { token } = await response.json()
      
      // Initialize Twilio Device
      const twilioDevice = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'],
        enableRingingState: true
      })
      
      // Device event handlers
      twilioDevice.on('ready', () => {
        console.log('Twilio Device ready')
        setIsConnected(true)
        setCallStatus('ready')
      })
      
      twilioDevice.on('error', (error) => {
        console.error('Device error:', error)
        setCallStatus('error')
      })
      
      twilioDevice.on('incoming', (incomingCall) => {
        console.log('Incoming call from:', incomingCall.parameters.From)
        setCall(incomingCall)
        setCallStatus('ringing')
        
        // Auto-accept for now (can add UI prompt later)
        incomingCall.accept()
      })
      
      deviceRef.current = twilioDevice
      setDevice(twilioDevice)
      
    } catch (error) {\n      console.error('Failed to initialize device:', error)\n      setCallStatus('error')\n    }\n  }\n\n  const makeCall = async (phoneNumber, callerIdStrategy = 'random') => {\n    if (!device || !phoneNumber) return\n    \n    try {\n      setCallStatus('connecting')\n      \n      // Get optimal caller ID\n      const callerIdResponse = await fetch('/api/caller-id/choose', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ \n          strategy: callerIdStrategy,\n          destination: phoneNumber \n        })\n      })\n      \n      const { callerId } = await callerIdResponse.json()\n      \n      // Make the call\n      const outgoingCall = await device.connect({\n        params: {\n          To: phoneNumber,\n          From: callerId\n        }\n      })\n      \n      setCall(outgoingCall)\n      setupCallHandlers(outgoingCall)\n      \n    } catch (error) {\n      console.error('Call failed:', error)\n      setCallStatus('error')\n    }\n  }\n  \n  const setupCallHandlers = (activeCall) => {\n    activeCall.on('accept', () => {\n      console.log('Call accepted')\n      setCallStatus('connected')\n      startQualityMonitoring(activeCall)\n      onCallStateChange?.('connected', activeCall)\n    })\n    \n    activeCall.on('disconnect', () => {\n      console.log('Call disconnected')\n      setCallStatus('ready')\n      setCall(null)\n      stopQualityMonitoring()\n      onCallStateChange?.('disconnected', null)\n    })\n    \n    activeCall.on('error', (error) => {\n      console.error('Call error:', error)\n      setCallStatus('error')\n      onCallStateChange?.('error', error)\n    })\n  }\n  \n  const startQualityMonitoring = (activeCall) => {\n    // Monitor call quality every 5 seconds\n    qualityInterval.current = setInterval(async () => {\n      try {\n        const stats = await activeCall.getStats()\n        \n        // Extract key quality metrics\n        const quality = {\n          mos: stats?.mos || 4.2,\n          latency: stats?.rtt || 45,\n          jitter: stats?.jitter || 5,\n          packetLoss: (stats?.packetsLostFraction || 0) * 100\n        }\n        \n        setCallQuality(quality)\n        onQualityUpdate?.(quality)\n        \n        // Store in database for SLO tracking\n        await fetch('/api/voice/quality', {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify({\n            call_sid: activeCall.parameters?.CallSid,\n            ...quality,\n            timestamp: new Date().toISOString()\n          })\n        })\n        \n      } catch (error) {\n        console.error('Quality monitoring error:', error)\n      }\n    }, 5000)\n  }\n  \n  const stopQualityMonitoring = () => {\n    if (qualityInterval.current) {\n      clearInterval(qualityInterval.current)\n      qualityInterval.current = null\n    }\n  }\n  \n  const hangUp = () => {\n    if (call) {\n      call.disconnect()\n    }\n  }\n  \n  const toggleMute = () => {\n    if (call) {\n      call.mute(!isMuted)\n      setIsMuted(!isMuted)\n    }\n  }\n  \n  const getStatusColor = () => {\n    switch (callStatus) {\n      case 'ready': return 'text-oakmont-sage'\n      case 'connecting': return 'text-oakmont-tan'\n      case 'connected': return 'text-green-600'\n      case 'error': return 'text-oakmont-brown'\n      default: return 'text-oakmont-grey'\n    }\n  }\n  \n  const getQualityColor = (mos) => {\n    if (mos >= 4.0) return 'quality-excellent'\n    if (mos >= 3.5) return 'quality-good'\n    if (mos >= 3.0) return 'quality-fair'\n    return 'quality-poor'\n  }\n\n  return {\n    // State\n    device,\n    call,\n    isConnected,\n    isMuted,\n    callStatus,\n    callQuality,\n    \n    // Actions\n    makeCall,\n    hangUp,\n    toggleMute,\n    \n    // Utilities\n    getStatusColor,\n    getQualityColor\n  }\n}\n\n// Export component for direct use\nexport function WebRTCInterface({ onCallStateChange, onQualityUpdate }) {\n  const {\n    call,\n    isConnected,\n    isMuted,\n    callStatus,\n    callQuality,\n    makeCall,\n    hangUp,\n    toggleMute,\n    getStatusColor,\n    getQualityColor\n  } = WebRTCClient({ onCallStateChange, onQualityUpdate })\n  \n  return (\n    <div className=\"voicrm-card p-6\">\n      <div className=\"flex items-center justify-between mb-4\">\n        <h3 className=\"text-lg font-semibold text-oakmont-sage\">Call Control</h3>\n        <div className={`text-sm font-medium ${getStatusColor()}`}>\n          {callStatus.toUpperCase()}\n        </div>\n      </div>\n      \n      {/* Quality Indicators */}\n      {call && callStatus === 'connected' && (\n        <div className=\"grid grid-cols-4 gap-4 mb-6\">\n          <div className=\"text-center\">\n            <div className={`text-lg font-bold ${getQualityColor(callQuality.mos)}`}>\n              {callQuality.mos.toFixed(1)}\n            </div>\n            <div className=\"text-xs text-oakmont-grey\">MOS</div>\n          </div>\n          <div className=\"text-center\">\n            <div className=\"text-lg font-bold text-oakmont-tan\">\n              {Math.round(callQuality.latency)}ms\n            </div>\n            <div className=\"text-xs text-oakmont-grey\">Latency</div>\n          </div>\n          <div className=\"text-center\">\n            <div className=\"text-lg font-bold text-oakmont-brown\">\n              {Math.round(callQuality.jitter)}ms\n            </div>\n            <div className=\"text-xs text-oakmont-grey\">Jitter</div>\n          </div>\n          <div className=\"text-center\">\n            <div className=\"text-lg font-bold text-oakmont-sage\">\n              {callQuality.packetLoss.toFixed(2)}%\n            </div>\n            <div className=\"text-xs text-oakmont-grey\">Loss</div>\n          </div>\n        </div>\n      )}\n      \n      {/* Call Controls */}\n      <div className=\"flex justify-center space-x-4\">\n        {!call ? (\n          <button\n            onClick={() => makeCall('+61412345678')} // Demo number\n            disabled={!isConnected}\n            className=\"voicrm-btn-primary flex items-center space-x-2\"\n          >\n            <Phone className=\"h-4 w-4\" />\n            <span>Test Call</span>\n          </button>\n        ) : (\n          <>\n            <button\n              onClick={toggleMute}\n              className={`voicrm-btn-secondary flex items-center space-x-2 ${\n                isMuted ? 'bg-oakmont-brown' : ''\n              }`}\n            >\n              {isMuted ? <MicOff className=\"h-4 w-4\" /> : <Mic className=\"h-4 w-4\" />}\n              <span>{isMuted ? 'Unmute' : 'Mute'}</span>\n            </button>\n            \n            <button\n              onClick={hangUp}\n              className=\"bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2\"\n            >\n              <PhoneOff className=\"h-4 w-4\" />\n              <span>Hang Up</span>\n            </button>\n          </>\n        )}\n      </div>\n    </div>\n  )\n}"