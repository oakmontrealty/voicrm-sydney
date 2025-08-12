# VoiCRM Sydney
**Professional VoIP-CRM Platform for Sydney Real Estate**

![VoiCRM](https://img.shields.io/badge/VoiCRM-Production%20Ready-green)
![Sydney](https://img.shields.io/badge/Sydney-Optimized-blue)
![Real Estate](https://img.shields.io/badge/Real%20Estate-Specialized-orange)

## 🏗️ Architecture Overview

**Tech Stack:**
- **Frontend:** Next.js 14 + React 18 + Tailwind CSS
- **Backend:** Next.js API routes + Supabase PostgreSQL
- **Telephony:** Twilio Voice + WebRTC Device SDK
- **AI:** OpenAI Whisper (transcription) + GPT-4 (coaching)
- **Deployment:** Vercel + GitHub Actions

**Key Features:**
- ✅ Real-time WebRTC calling with quality monitoring
- ✅ Smart caller ID rotation (Number Carousel)
- ✅ Live transcription with AI coaching
- ✅ Team collision prevention
- ✅ Australian phone number optimization
- ✅ Mobile-first responsive design
- ✅ Oakmont Realty branding

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Twilio account with Voice API
- Supabase project
- OpenAI API key

### Local Development
```bash
git clone https://github.com/oakmontrealty/voicrm-sydney.git
cd voicrm-sydney
npm install
cp .env.example .env.local
npm run dev
```

### Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://didmparfeydjbcuzgaif.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Twilio  
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_TWIML_APP_SID=your_twiml_app_sid
TWILIO_API_KEY_SID=your_api_key_sid
TWILIO_API_KEY_SECRET=your_api_key_secret

# OpenAI
OPENAI_API_KEY=your_openai_key

# App
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=https://voicrm-sydney.vercel.app
```

## 📞 Call Quality SLOs

**Target Performance:**
- **MOS Score:** ≥ 4.2 average
- **End-to-End Latency:** ≤ 150ms  
- **Jitter:** ≤ 20ms
- **Packet Loss:** ≤ 1%
- **Connection Success Rate:** ≥ 99.1%
- **System Uptime:** 99.95%

**Monitoring:**
- Real-time quality metrics dashboard
- Automated SLO breach alerts
- 24/7 testing across Sydney carriers
- Weekly quality reports

## 🇦🇺 Australian Compliance

**ACMA Compliance:**
- ✅ Proper +61 number formatting
- ✅ Carrier-specific optimizations
- ✅ Do Not Call register integration ready
- ✅ Recording consent capture

**Privacy Act 1988:**
- ✅ Consent tracking and storage
- ✅ Opt-out mechanisms
- ✅ Data retention policies
- ✅ Audit trail maintenance

## 🏗️ Database Schema

**Core Tables (14 total):**
```sql
-- Contact Management
contacts (23 fields) - Full contact profiles with lead scoring
properties (31 fields) - Property-centric design for real estate
interactions (20 fields) - Multi-channel communication history
deals (18 fields) - Real estate pipeline stages

-- Telephony System  
call_logs (9 fields) - Twilio integration with quality metrics
phone_numbers (15 NSW DIDs) - Number carousel management
caller_id_assignments - Usage tracking and optimization
call_quality_metrics - SLO monitoring and alerting

-- AI Features
transcripts (7 fields) - Real-time Whisper integration
ai_analysis (15 fields) - GPT-4 insights and coaching
voice_commands (9 fields) - Voice-to-action logging

-- Team Management
teams, profiles, campaigns, tasks, property_interests
```

## 🔌 API Endpoints

**Voice APIs:**
- `POST /api/voice/token` - Generate Twilio access tokens
- `POST /api/voice/handler` - TwiML call routing
- `POST /api/voice/quality` - Store call quality metrics
- `POST /api/voice/stream` - Real-time transcription WebSocket

**Caller ID Management:**
- `POST /api/caller-id/choose` - Smart DID selection
- `GET /api/caller-id/pool` - Number pool management
- `POST /api/caller-id/route` - Inbound call routing

**Contact Management:**
- `POST /api/contacts/collision` - Team collision detection
- `GET /api/contacts` - Contact CRUD operations
- `POST /api/contacts/search` - Advanced contact search

## 🎯 Real Estate Workflows

**Property-Centric Pipeline:**
1. **New Lead** → Initial contact and qualification
2. **Viewing Set** → Property inspection scheduled  
3. **Offer Stage** → Negotiation in progress
4. **Exchanged** → Contracts signed
5. **Settled** → Transaction completed

**Specialized Features:**
- Open house rapid check-in via voice commands
- Property matching during live calls
- Commission tracking and forecasting
- MLS integration for property data
- Mobile-optimized for field agents

## 🧠 AI Features

**Real-Time Coaching:**
- Sub-300ms response time for coaching tips
- Australian real estate specific prompts
- Objection handling suggestions
- Appointment timing recommendations

**Call Intelligence:**
- Live transcription with speaker diarization
- Sentiment analysis and intent detection
- Automated call summaries
- Lead scoring (1-10 scale)
- Next action recommendations

## 📱 Mobile Optimization

**Sydney Field Agent Design:**
- Touch-friendly interface for mobile use
- Offline contact access
- Voice commands while driving
- NBN and mobile carrier optimization
- GPS-based lead logging

## 🔧 Development Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run test suite

# Deployment
npm run deploy       # Deploy to Vercel
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed with test data
```

## 🧪 Testing

**Automated Testing:**
- Unit tests with Jest
- Integration tests with Playwright
- Load testing with Artillery
- End-to-end testing across carriers

**Manual Testing Protocol:**
- Test calls every 15 minutes
- Rotate Sydney carriers (Telstra/Optus/Vodafone)
- Validate SLO compliance
- Mobile device testing

## 📊 Monitoring & Analytics

**Real-Time Dashboards:**
- Call quality metrics (MOS, latency, jitter)
- Number carousel performance
- AI coaching effectiveness
- Team productivity analytics

**Alerting:**
- SLO breach notifications
- System downtime alerts
- Quality degradation warnings
- Performance optimization suggestions

## 🚀 Deployment

**Vercel Configuration:**
1. Import GitHub repository
2. Configure environment variables
3. Set custom domain (optional)
4. Enable automatic deployments

**Twilio Setup:**
1. Configure TwiML App webhooks
2. Purchase Sydney phone numbers
3. Set up SIP domains
4. Configure voice insights

## 🔒 Security

**Authentication:**
- NextAuth.js with Supabase integration
- Row Level Security (RLS) policies
- API key rotation strategy
- Secure token management

**Compliance:**
- ACMA telephony regulations
- Privacy Act 1988 requirements
- Recording consent protocols
- Data retention policies

## 📈 Performance Targets

**System Performance:**
- Page load: < 2 seconds
- API response: < 500ms
- WebRTC setup: < 5 seconds
- Real-time coaching: < 300ms

**Business Metrics:**
- Answer rate improvement: +25%
- Call efficiency: +40%
- Lead conversion: +15%
- Agent productivity: +30%

## 🤝 Contributing

**Development Workflow:**
1. Create feature branch from `main`
2. Implement changes with tests
3. Run quality checks locally
4. Submit PR with detailed description
5. Automated testing and review
6. Merge to `main` and auto-deploy

**Code Standards:**
- ESLint + Prettier configuration
- TypeScript for type safety
- Comprehensive error handling
- Performance-first development

## 📞 Support

**Technical Issues:**
- GitHub Issues for bug reports
- Pull Requests for contributions
- Discussions for feature requests

**Business Inquiries:**
- Email: hello@oakmontrealty.com.au
- Phone: 1300 501 399
- Website: www.oakmontrealty.com.au

---

**VoiCRM Sydney - Transforming Real Estate Communication**  
*Built for Sydney agents, optimized for Australian networks, powered by AI*