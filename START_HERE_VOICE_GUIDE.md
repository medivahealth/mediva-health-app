# 🚀 START HERE - Voice Agent Quick Launch

## ⚡ 2-Minute Setup

Your voice agent is **READY TO TEST**! Just follow these steps:

---

## Step 1: Start Backend (Terminal 1)

```bash
cd backend
npm run start:dev
```

**Wait for:** `Application started on port 3000`

---

## Step 2: Add Test Screen to App.tsx

Open `App.tsx` and add this route:

```typescript
import VoiceTestScreen from './src/screens/VoiceTestScreen';

// In your navigator, add:
<Stack.Screen name="VoiceTest" component={VoiceTestScreen} />
```

---

## Step 3: Start App (Terminal 2)

```bash
npm start
```

Press `a` for Android or `i` for iOS

---

## Step 4: Navigate & Test

1. In your app, navigate to the "VoiceTest" screen
2. Click the **microphone button** 🎤
3. Allow microphone permissions
4. Say: **"Hello doctor, I'm not feeling well"**

---

## ✨ What You'll See

### The Beautiful Orb:
- 🟢 **Gently pulses** when idle (like breathing)
- 🔵 **Expands & glows** when listening
- 🟣 **Pulses rhythmically** when speaking
- 💫 **Wobbles thoughtfully** when processing

### The Conversation:
```
You: "Hello doctor, I'm not feeling well"

AI: "Hello! I'm Dr. Mediva. I understand you're not feeling well. 
     Can you tell me what symptoms you're experiencing? 
     Please describe how you're feeling in your own words."
```

The AI will:
- ✅ Greet you warmly and professionally
- ✅ Ask empathetic follow-up questions
- ✅ Detect your language automatically
- ✅ Check for emergency symptoms
- ✅ Consider your medical history
- ✅ Provide medically-safe advice
- ✅ Speak responses naturally

---

## 🎯 Try These Conversations

### 1. General Symptom Check
**Say:** "I have a headache since morning"

**AI Response:** Will ask about pain level, other symptoms, duration

### 2. Drug Interaction Check
**Say:** "Can I take ibuprofen with my current medicines?"

**AI Response:** Will check your medications and warn about interactions

### 3. Emergency Detection
**Say:** "I have chest pain and difficulty breathing"

**AI Response:** Will detect emergency and tell you to call 108 immediately

### 4. Multilingual Test
**Hindi:** "नमस्ते डॉक्टर, मुझे बुखार है"

**Telugu:** "నమస్తే డాక్టర్, నాకు తలనొప్పిగా ఉంది"

**AI Response:** Will respond in the same language

### 5. Chronic Condition
**Say:** "My blood sugar has been high lately, around 180-200"

**AI Response:** Will check your history and suggest adjustments

---

## 📱 Full Integration (After Testing)

Once tested, integrate into your existing screens:

### Option A: Use in Any Existing Screen

```typescript
import VoiceAgent from '../components/VoiceAgent';

// In your screen's render:
<VoiceAgent 
  onMessage={(msg) => console.log(msg)}
  onResponse={(res) => console.log(res)}
  onClose={() => navigation.goBack()}
/>
```

### Option B: Enhance VoiceBotScreen

Your existing `VoiceBotScreen.tsx` is already excellent! Keep using it.

To add OpenRouter integration, see `QUICK_START_VOICE.md`.

---

## 🔧 What's Included

### Medical Features:
✅ **Emergency Detection** - Automatic triage for serious symptoms  
✅ **Drug Safety** - FDA/CDSCO interaction checking  
✅ **Continuous Learning** - Learns from doctor corrections  
✅ **Predictive Analytics** - Proactive health alerts  
✅ **RAG System** - Medical knowledge base access  
✅ **Multilingual** - Auto-detects 7+ languages  

### Technical Features:
✅ **Fluid 3D Animations** - Beautiful orb with rotating gradients  
✅ **Real-time Transcription** - Web Speech API  
✅ **Natural TTS** - ElevenLabs quality voices  
✅ **Health Context** - Knows patient medications/conditions  
✅ **Chat History** - Tracks conversation sessions  
✅ **Error Handling** - Graceful fallbacks  

---

## 🎨 The Orb Animation

Created with **3 rotating gradient layers**:

```typescript
Layer 1: Green (#10B981) → rotates clockwise
Layer 2: Blue (#3B82F6) → rotates counter-clockwise  
Layer 3: Purple (#8B5CF6) → pulses gently
Core: Glowing center with shadow effects
```

**States:**
- **Idle**: Scale 1.0, opacity 0.5, gentle pulse
- **Listening**: Scale 1.2, opacity 0.8, bright glow
- **Speaking**: Scale 1.0 ↔ 1.1, rhythmic pulsing
- **Processing**: Wobble animation, thoughtful purple

---

## 🐛 Troubleshooting

### "Cannot connect to backend"

**Check:**
```bash
# Terminal 1: Backend running?
cd backend
npm run start:dev

# Should show: "Application started on port 3000"
```

**Fix IP if needed:**
Edit `src/services/openrouter.ts` line 12:
```typescript
'http://YOUR_IP_HERE:3000/api/chat/message'
```

Find your IP:
```bash
ipconfig  # Look for IPv4 Address
```

### "No audio response"

**Check volume and permissions:**
- Phone media volume up
- Settings → Privacy → Microphone (enable for app)
- Settings → Accessibility → Text-to-Speech

**Test TTS endpoint:**
```bash
curl "http://192.168.3.137:3000/chat/tts?text=Hello"
```

### "Orb not showing"

**Restart Expo with cache clear:**
```bash
npm start -- --clear
```

### "Microphone not working"

**Grant permissions:**
- iOS: Settings → Privacy → Microphone
- Android: Settings → Apps → Mediva → Permissions

---

## 📊 Architecture Overview

```
User Speaks
    ↓
Web Speech API (Free, built-in)
    ↓
VoiceConversationService
    ↓
Adds: System Prompt + Health Context
    ↓
Mediva Backend (/api/chat/message)
    ↓
┌──────────────────────────────────┐
│ 1. Emergency Detection           │
│ 2. RAG Context Building          │
│ 3. Drug Safety Check             │
│ 4. Multi-Agent Processing        │
│ 5. Continuous Learning           │
│ 6. Predictive Analytics          │
└──────────────────────────────────┘
    ↓
OpenRouter API (Claude 3.5 Sonnet)
    ↓
Medically Safe Response
    ↓
ElevenLabs TTS (or system fallback)
    ↓
User Hears + Sees Response
```

---

## 💡 Key Files Created

### Components & Services:
- `src/components/VoiceAgent.tsx` - Main voice component
- `src/services/openrouter.ts` - OpenRouter integration
- `src/services/voice-conversation.ts` - Conversation management
- `src/screens/VoiceTestScreen.tsx` - Quick test screen

### Documentation:
- `START_HERE_VOICE_GUIDE.md` ← **This file!**
- `TEST_VOICE_AGENT.md` - Detailed testing guide
- `VOICE_AGENTS_OVERVIEW.md` - Complete overview
- `QUICK_START_VOICE.md` - Integration examples
- `VOICE_AGENT_INTEGRATION.md` - Technical deep dive

---

## ✅ Production Checklist

Before deploying:

- [ ] Backend accessible from mobile
- [ ] Microphone permissions working
- [ ] TTS volume appropriate
- [ ] Emergency protocols tested
- [ ] Error messages user-friendly
- [ ] HIPAA compliance addressed
- [ ] User consent obtained
- [ ] Analytics tracking ready

---

## 🌟 What Makes This Special

### 1. Medical Intelligence
Not just a chatbot - it's a **medical AI system** with:
- FDA/CDSCO drug safety checks
- Emergency symptom detection
- Continuous learning from doctors
- Predictive health analytics
- Access to medical knowledge base

### 2. Personalized Care
The AI knows:
- Your medications (from health records)
- Your conditions (from medical history)
- Your wearable data (Fitbit, Garmin, etc.)
- Your past conversations
- Your health trends

### 3. Natural Conversation
- Speaks your language (auto-detects)
- Empathetic, professional tone
- Asks relevant follow-up questions
- Explains in simple terms
- Never diagnoses definitively

### 4. Beautiful UI
- Fluid 3D orb animations
- Calming color palette
- Smooth transitions
- Professional appearance

---

## 🎯 Next Steps

### Immediate (Now):
1. ✅ Start backend
2. ✅ Add test screen
3. ✅ Start app
4. ✅ Test conversation

### Short-term (Today):
1. Read `TEST_VOICE_AGENT.md` for detailed examples
2. Try different conversation scenarios
3. Test emergency detection
4. Test multilingual support

### Long-term (Production):
1. Integrate into main app flow
2. Customize system prompt
3. Add more health data sources
4. Implement analytics
5. A/B test different models

---

## 💬 Example Full Conversation

```
👤 User: "Hello doctor, I have been having stomach pain"

🤖 AI: "Hello! I understand you're experiencing stomach pain. 
       I'm here to help. Can you tell me where exactly in your 
       stomach the pain is located? Is it in the upper part, 
       lower part, or all over?"

👤 User: "It's in the upper part, right side"

🤖 AI: "Thank you for that information. Pain in the upper right 
       side of the abdomen could be related to the gallbladder 
       or liver. Let me ask - does the pain get worse after 
       eating fatty or oily foods? And are you experiencing any 
       nausea or fever?"

👤 User: "Yes, especially after fried food. And I feel nauseous"

🤖 AI: "I see. The combination of upper right abdominal pain, 
       nausea, and worsening after fatty foods could suggest 
       gallbladder issues like gallstones. This is something 
       that should be evaluated by a doctor soon. Are you able 
       to see a healthcare provider today? Also, let me check 
       your current medications to ensure there are no concerns."
```

Notice how the AI:
- ✅ Acknowledges symptoms empathetically
- ✅ Asks targeted follow-up questions
- ✅ Uses uncertain language ("could be")
- ✅ Suggests seeing a doctor
- ✅ Checks medication history

---

## 🎉 You're All Set!

Everything is configured and ready to test. Your voice agent has:

✅ **Beautiful fluid 3D orb** animations  
✅ **Full medical AI capabilities**  
✅ **Emergency detection**  
✅ **Drug safety checking**  
✅ **Multilingual support**  
✅ **Health context awareness**  
✅ **Production-ready code**  

Just run the commands above and start talking! 🚀

---

## 📞 Quick Commands Reference

### Start Everything:
```bash
# Terminal 1
cd backend
npm run start:dev

# Terminal 2  
npm start
```

### Test Endpoints:
```bash
# Chat
curl -X POST http://192.168.3.137:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello doctor"}'

# TTS
curl "http://192.168.3.137:3000/chat/tts?text=Hello"
```

### Check Backend Logs:
```bash
cd backend
npm run start:dev
# Watch for /api/chat/message requests
```

---

**Need help?** Check these files in order:
1. This file (`START_HERE_VOICE_GUIDE.md`) ← You are here
2. `TEST_VOICE_AGENT.md` - Detailed testing examples
3. `VOICE_AGENTS_OVERVIEW.md` - Complete comparison
4. `QUICK_START_VOICE.md` - Integration patterns

**Happy testing!** 🩺✨🎙️
