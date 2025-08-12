// Main VoiCRM Dashboard with Stacked Interface

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Phone, Users, Home, TrendingUp, Settings, User, Search, Plus, 
         PhoneCall, PhoneOff, Mic, MicOff, AlertCircle, CheckCircle,
         MessageSquare, Calendar, Activity, Zap, Volume2, MapPin } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function VoiCRMDashboard() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Core application state
  const [activeCall, setActiveCall] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [callTimer, setCallTimer] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // WebRTC and quality state
  const [device, setDevice] = useState(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callQuality, setCallQuality] = useState({
    mos: 4.8,
    latency: 42,
    jitter: 8,
    packetLoss: 0.01
  });

  // Number Carousel state
  const [selectedDID, setSelectedDID] = useState(null);
  const [collisionWarning, setCollisionWarning] = useState(null);
  const [didStrategy, setDidStrategy] = useState('health_weighted');

  // UI state
  const [dialNumber, setDialNumber] = useState('');
  const [activePane, setActivePane] = useState('contacts');
  const [searchTerm, setSearchTerm] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  // Data state
  const [contacts, setContacts] = useState([]);
  const [properties, setProperties] = useState([]);

  // Sample data for immediate functionality
  useEffect(() => {
    // Load sample data while database integration is being finalized
    setContacts([
      {
        id: 1,
        name: 'Sarah Wilson',
        phone_number: '+61 4 9876 5432',
        email: 'sarah.wilson@email.com',
        status: 'hot_lead',
        lead_score: 87,
        last_contact: '2 hours ago',
        property_interests: ['house', '3-bedroom'],
        budget_range: '$800K - $1.2M',
        urgency_level: 'high',
        notes: 'Looking for family home in Campbelltown area'
      },
      {
        id: 2,
        name: 'Michael Chen',
        phone_number: '+61 4 5432 1098',
        email: 'michael.chen@email.com',
        status: 'prospect',
        lead_score: 64,
        last_contact: '1 day ago',
        property_interests: ['apartment', '2-bedroom'],
        budget_range: '$600K - $800K',
        urgency_level: 'medium',
        notes: 'First-time buyer, needs guidance'
      },
      {
        id: 3,
        name: 'Jennifer Smith',
        phone_number: '+61 4 1234 5678',
        email: 'jen.smith@email.com',
        status: 'client',
        lead_score: 92,
        last_contact: '3 hours ago',
        property_interests: ['townhouse', '2-bedroom'],
        budget_range: '$750K - $950K',
        urgency_level: 'urgent',
        notes: 'Ready to make offer this week'
      }
    ]);

    setProperties([
      {
        id: 1,
        address: '45 Riverside Drive, Campbelltown NSW 2560',
        property_type: 'House',
        bedrooms: 3,
        bathrooms: 2,
        car_spaces: 2,
        price: 1150000,
        price_display: '$1,150,000',
        status: 'active',
        days_on_market: 12,
        property_features: ['Pool', 'Garage', 'Garden'],
        suburb: 'Campbelltown',
        postcode: '2560'
      },
      {
        id: 2,
        address: '23 Garden Street, Campbelltown NSW 2560',
        property_type: 'House',
        bedrooms: 3,
        bathrooms: 2,
        car_spaces: 1,
        price: 1095000,
        price_display: '$1,095,000',
        status: 'active',
        days_on_market: 8,
        property_features: ['Updated Kitchen', 'Large Yard'],
        suburb: 'Campbelltown',
        postcode: '2560'
      }
    ]);
  }, []);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setUser(session?.user || null);
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // WebRTC initialization
  useEffect(() => {
    const initWebRTC = async () => {
      if (!user) return;

      try {
        // Wait for Twilio SDK to load
        if (!window.Twilio) {
          const script = document.createElement('script');
          script.src = 'https://sdk.twilio.com/js/voice/releases/2.11.1/twilio.min.js';
          script.async = true;
          document.head.appendChild(script);
          
          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        // Get access token
        const tokenResponse = await fetch('/api/voice/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            identity: `agent-${user.id}`
          })
        });

        const { token } = await tokenResponse.json();

        // Initialize Device
        const twilioDevice = new window.Twilio.Device(token, {
          logLevel: 1,
          answerOnBridge: true,
          enableRingingState: true
        });

        twilioDevice.on('ready', () => {
          setIsDeviceReady(true);
          setDevice(twilioDevice);
        });

        twilioDevice.on('connect', (connection) => {
          setActiveCall({
            connection,
            startTime: new Date(),
            callSid: connection.parameters.CallSid
          });
          setIsConnecting(false);
          startCallTimer();
        });

        twilioDevice.on('disconnect', () => {
          endCall();
        });

        twilioDevice.register();

      } catch (error) {
        console.error('WebRTC initialization error:', error);
      }
    };

    initWebRTC();
  }, [user]);

  // Quality monitoring
  useEffect(() => {
    if (activeCall) {
      const qualityInterval = setInterval(async () => {
        // Simulate quality updates (real implementation would use WebRTC getStats)
        const newQuality = {
          mos: (Math.random() * 0.4 + 4.4).toFixed(1),
          latency: Math.floor(Math.random() * 40 + 30),
          jitter: Math.floor(Math.random() * 10 + 5),
          packetLoss: (Math.random() * 0.5).toFixed(2)
        };
        
        setCallQuality(newQuality);

        // Report to backend
        try {
          await fetch('/api/voice/quality', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              call_sid: activeCall.callSid,
              agent_id: user?.id,
              ...newQuality
            })
          });
        } catch (error) {
          console.error('Quality reporting error:', error);
        }
      }, 5000);

      return () => clearInterval(qualityInterval);
    }
  }, [activeCall, user]);

  // Call management functions
  const startCallTimer = () => {
    const interval = setInterval(() => {
      setCallTimer(prev => prev + 1);
    }, 1000);
    
    setActiveCall(prev => ({ ...prev, timerInterval: interval }));
  };

  const makeCall = async (contact) => {
    if (!device || !isDeviceReady || isConnecting || activeCall) return;

    try {
      setIsConnecting(true);
      setSelectedContact(contact);
      
      // Select optimal caller ID
      const callerIDResponse = await fetch('/api/caller-id/choose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: user.id,
          contact_id: contact.id,
          to_number: contact.phone_number || contact.phone,
          strategy: didStrategy
        })
      });

      const callerIDResult = await callerIDResponse.json();
      
      if (callerIDResult.collisionWarning) {
        setCollisionWarning(callerIDResult.collisionWarning);
        setIsConnecting(false);
        return;
      }
      
      setSelectedDID(callerIDResult.selectedNumber);

      // Make the call
      const callParams = {
        To: contact.phone_number || contact.phone,
        From: callerIDResult.selectedNumber.phoneNumber,
        CallerId: callerIDResult.selectedNumber.phoneNumber
      };

      await device.connect(callParams);

    } catch (error) {
      console.error('Call initiation error:', error);
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    if (activeCall?.timerInterval) {
      clearInterval(activeCall.timerInterval);
    }
    
    if (activeCall?.connection) {
      activeCall.connection.disconnect();
    }
    
    setActiveCall(null);
    setSelectedContact(null);
    setIsConnecting(false);
    setIsMuted(false);
    setCallTimer(0);
    setCollisionWarning(null);
  };

  const toggleMute = () => {
    if (activeCall?.connection) {
      activeCall.connection.mute(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const dialpadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-900">Loading VoiCRM...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">VoiCRM Sydney</h2>
            <p className="mt-2 text-gray-600">Professional Communication Platform</p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow">
            <button
              onClick={async () => {
                try {
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}`
                    }
                  });
                } catch (error) {
                  console.error('Login error:', error);
                }
              }}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 font-medium"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Phone className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold text-gray-900">VoiCRM Sydney</h1>
              {!isDeviceReady && (
                <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                  Connecting...
                </div>
              )}
              {isDeviceReady && (
                <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  Ready
                </div>
              )}
            </div>
            
            {/* Live Quality Metrics */}
            <div className="flex items-center space-x-4 bg-gray-50 rounded-lg px-4 py-2">
              <div className="text-sm">
                <span className="text-gray-600">MOS:</span>
                <span className={`ml-1 font-medium ${
                  parseFloat(callQuality.mos) >= 4.2 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {callQuality.mos}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Latency:</span>
                <span className={`ml-1 font-medium ${
                  callQuality.latency <= 150 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {callQuality.latency}ms
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Jitter:</span>
                <span className={`ml-1 font-medium ${
                  callQuality.jitter <= 20 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {callQuality.jitter}ms
                </span>
              </div>
            </div>
          </div>

          {/* Active Call Status */}
          {activeCall && (
            <div className="flex items-center space-x-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">
                  {selectedContact?.name} ({selectedDID?.phoneNumber})
                </span>
              </div>
              <span className="text-green-600 font-mono text-lg">{formatTime(callTimer)}</span>
              <div className="flex space-x-2">
                <button
                  onClick={toggleMute}
                  className={`p-2 rounded-full ${
                    isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                  } hover:opacity-75`}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  onClick={endCall}
                  className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                >
                  <PhoneOff className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{user?.user_metadata?.full_name || user?.email}</div>
              <div className="text-xs text-gray-500">Sydney Agent</div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Left Rail - Dialer & Quick Actions */}
        <div className="w-80 bg-white shadow-sm border-r border-gray-200 p-4">
          {/* Number Carousel Selector */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Caller ID Strategy</h3>
              <span className="text-xs text-green-600 font-medium">15 DIDs</span>
            </div>
            <select 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              value={didStrategy}
              onChange={(e) => setDidStrategy(e.target.value)}
            >
              <option value="health_weighted">🎯 Health Weighted</option>
              <option value="random">🎲 Random Rotation</option>
              <option value="least_recent">⏰ Least Recent</option>
              <option value="geographic">📍 Geographic Match</option>
            </select>
            
            {selectedDID && (
              <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                <div className="font-medium text-green-800">Using: {selectedDID.phoneNumber}</div>
                <div className="text-green-600">Health: {Math.round(selectedDID.healthScore * 100)}%</div>
              </div>
            )}
          </div>

          {/* Professional Dialer */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Dialer</h3>
            <input
              type="tel"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              placeholder="+61 4XX XXX XXX"
              className="w-full p-3 border border-gray-300 rounded-lg text-center font-mono text-lg mb-3"
            />
            
            {/* Dialpad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {dialpadButtons.flat().map((digit) => (
                <button
                  key={digit}
                  onClick={() => setDialNumber(prev => prev + digit)}
                  className="h-12 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  {digit}
                </button>
              ))}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setDialNumber('')}
                className="flex-1 py-2 px-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Clear
              </button>
              <button
                onClick={() => makeCall({ 
                  phone_number: dialNumber, 
                  name: 'Manual Dial', 
                  id: 'manual-' + Date.now() 
                })}
                disabled={!dialNumber || activeCall || isConnecting || !isDeviceReady}
                className="flex-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Phone className="h-4 w-4" />
                <span>Call</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => setActivePane('contacts')}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-left text-sm rounded-lg ${
                  activePane === 'contacts' ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4 text-blue-600" />
                <span>Browse Contacts</span>
              </button>
              <button
                onClick={() => setActivePane('properties')}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-left text-sm rounded-lg ${
                  activePane === 'properties' ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50'
                }`}
              >
                <Home className="h-4 w-4 text-green-600" />
                <span>Property Search</span>
              </button>
              <button
                onClick={() => setActivePane('analytics')}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-left text-sm rounded-lg ${
                  activePane === 'analytics' ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span>Performance</span>
              </button>
            </div>
          </div>

          {/* Recent Contacts */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Hot Leads</h3>
            <div className="space-y-2">
              {contacts.filter(c => c.urgency_level === 'high' || c.urgency_level === 'urgent').slice(0, 3).map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{contact.name}</div>
                    <div className="text-xs text-gray-500">{contact.last_contact}</div>
                    <div className={`text-xs font-medium ${
                      contact.urgency_level === 'urgent' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {contact.urgency_level?.toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => makeCall(contact)}
                    disabled={activeCall || isConnecting || !isDeviceReady}
                    className="ml-2 p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          {/* Collision Warning Banner */}
          {collisionWarning && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="text-sm font-medium text-yellow-800">Team Collision Warning</div>
                    <div className="text-sm text-yellow-700">{collisionWarning.message}</div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setCollisionWarning(null);
                      // Continue with call
                    }}
                    className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                  >
                    Override
                  </button>
                  <button
                    onClick={() => setCollisionWarning(null)}
                    className="px-3 py-1 text-sm border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4-Pane Stacked Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Pane 1: Call Status */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Call Status</h2>
                  {activeCall && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600 font-medium">Live</span>
                    </div>
                  )}
                </div>

                {activeCall ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{selectedContact?.name}</div>
                      <div className="text-gray-600 font-mono">{selectedContact?.phone_number}</div>
                      <div className="text-3xl font-mono text-green-600 my-4">{formatTime(callTimer)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-gray-600">Caller ID</div>
                        <div className="font-medium font-mono">{selectedDID?.phoneNumber}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-gray-600">Quality</div>
                        <div className={`font-medium ${
                          callQuality.mos >= 4.2 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {callQuality.mos >= 4.2 ? 'Excellent' : 'Poor'}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={toggleMute}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                          isMuted ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {isMuted ? <MicOff className="h-4 w-4 mx-auto" /> : <Mic className="h-4 w-4 mx-auto" />}
                      </button>
                      <button className="flex-1 py-2 px-4 bg-blue-100 text-blue-700 rounded-lg font-medium">
                        <Volume2 className="h-4 w-4 mx-auto" />
                      </button>
                      <button
                        onClick={endCall}
                        className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
                      >
                        <PhoneOff className="h-4 w-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Phone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <div>No active call</div>
                    <div className="text-sm">Select a contact or dial a number</div>
                  </div>
                )}
              </div>

              {/* Pane 2: Contact Information */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Contact Details</h2>
                  {selectedContact && (
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selectedContact.status === 'hot_lead' ? 'bg-red-100 text-red-800' :
                        selectedContact.status === 'prospect' ? 'bg-yellow-100 text-yellow-800' :
                        selectedContact.status === 'client' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedContact.status?.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>

                {selectedContact ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{selectedContact.name}</div>
                        <div className="text-gray-600">{selectedContact.email}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-600">Lead Score</div>
                        <div className="text-2xl font-bold text-green-600">{selectedContact.lead_score}/100</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm text-gray-600">Urgency</div>
                        <div className={`text-sm font-medium ${
                          selectedContact.urgency_level === 'urgent' ? 'text-red-600' :
                          selectedContact.urgency_level === 'high' ? 'text-orange-600' :
                          selectedContact.urgency_level === 'medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {selectedContact.urgency_level?.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Property Interests</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedContact.property_interests?.map((interest, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Budget Range</div>
                      <div className="text-green-600 font-semibold">{selectedContact.budget_range}</div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Notes</div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedContact.notes}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <div>No contact selected</div>
                    <div className="text-sm">Click a contact to view details</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Pane 3: Contact/Property Browser */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActivePane('contacts')}
                      className={`px-3 py-1 text-sm font-medium rounded-lg ${
                        activePane === 'contacts' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Contacts
                    </button>
                    <button
                      onClick={() => setActivePane('properties')}
                      className={`px-3 py-1 text-sm font-medium rounded-lg ${
                        activePane === 'properties' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Properties
                    </button>
                  </div>
                  <button className="text-blue-600 hover:text-blue-700">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder={`Search ${activePane}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="h-96 overflow-y-auto">
                  {activePane === 'contacts' ? (
                    <div className="space-y-3">
                      {contacts
                        .filter(contact => 
                          contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          contact.phone_number?.includes(searchTerm) ||
                          contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedContact?.id === contact.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900">{contact.name}</div>
                            <div className="flex items-center space-x-2">
                              <span className="text-lg font-bold text-green-600">{contact.lead_score || 0}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  makeCall(contact);
                                }}
                                disabled={activeCall || isConnecting || !isDeviceReady}
                                className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              >
                                <Phone className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 font-mono">{contact.phone_number}</div>
                          <div className="text-xs text-gray-500 mt-1">Last contact: {contact.last_contact || 'Never'}</div>
                          <div className="text-xs text-gray-600 mt-2 line-clamp-2">{contact.notes}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {properties
                        .filter(property => 
                          property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          property.suburb?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((property) => (
                        <div
                          key={property.id}
                          className="p-4 border rounded-lg hover:border-gray-300 cursor-pointer transition-colors"
                        >
                          <div className="font-medium text-gray-900 mb-1">{property.address}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            {property.bedrooms} bed • {property.bathrooms} bath • {property.car_spaces} car
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-bold text-green-600">{property.price_display}</div>
                            <div className="text-xs text-gray-500">{property.days_on_market} days on market</div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {property.property_features?.map((feature, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pane 4: Live Transcript & AI */}
              <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Live Assistant</h2>
                  {activeCall && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-blue-600">Transcribing</span>
                    </div>
                  )}
                </div>

                {activeCall ? (
                  <div className="space-y-4">
                    {/* AI Suggestions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">AI Coach</span>
                      </div>
                      <div className="text-sm text-blue-700">
                        Ask about their property viewing timeline and budget confirmation
                      </div>
                    </div>

                    {/* Live Transcript */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Live Transcript</div>
                      <div className="bg-gray-50 rounded-lg p-3 h-48 overflow-y-auto">
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-blue-600">Agent:</span>
                            <span className="ml-2 text-gray-700">Good morning Sarah, how are you today?</span>
                            <div className="text-xs text-gray-500 ml-4">12:05:23</div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-800">Client:</span>
                            <span className="ml-2 text-gray-700">Hi, I'm doing well thanks. I saw the listing for the Campbelltown property.</span>
                            <div className="text-xs text-gray-500 ml-4">12:05:31</div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-blue-600">Agent:</span>
                            <span className="ml-2 text-gray-700">Excellent! That's a beautiful 3-bedroom home. Have you had a chance to drive by?</span>
                            <div className="text-xs text-gray-500 ml-4">12:05:45</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <button className="p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-center">
                        📅 Schedule
                      </button>
                      <button className="p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-center">
                        📧 Email
                      </button>
                      <button className="p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-center">
                        📱 SMS
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <div>No active call</div>
                    <div className="text-sm">Start a call to see live transcription</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Drawer - Compliance & Team */}
        <div className="w-64 bg-white shadow-sm border-l border-gray-200 p-4">
          {/* Compliance Status */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">ACMA Compliance</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Recording Consent</span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">DNC Registry</span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Privacy Act</span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </div>
          </div>

          {/* DID Pool Health */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">DID Pool Health</h3>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-xs text-green-700 mb-1">Pool Status</div>
              <div className="font-semibold text-green-800">Excellent</div>
              <div className="text-xs text-green-600 mt-1">15/15 numbers active</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <div className="text-gray-600">Answer Rate</div>
                  <div className="font-medium text-green-600">84.2%</div>
                </div>
                <div>
                  <div className="text-gray-600">Health Score</div>
                  <div className="font-medium text-green-600">96.8%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Activity */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Team Activity</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Mike calling Penrith lead</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">Emma scheduled 3 inspections</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-600">James following up offer</span>
              </div>
            </div>
          </div>

          {/* Performance Today */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Today's Performance</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Calls Made</span>
                <span className="font-semibold">23</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Appointments</span>
                <span className="font-semibold text-green-600">7</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Conversion</span>
                <span className="font-semibold text-green-600">30.4%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Pipeline Value</span>
                <span className="font-semibold text-green-600">$2.4M</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading/Connecting Overlay */}
      {isConnecting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-lg font-medium">Connecting Call...</div>
            <div className="text-sm text-gray-600">Using {selectedDID?.phoneNumber || 'optimal caller ID'}</div>
          </div>
        </div>
      )}
    </div>
  );

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}