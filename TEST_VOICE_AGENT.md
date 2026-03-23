# 🎙️ Voice Agent - Quick Test Guide

## ✅ What You Have

Your Mediva AI app now has **full medical voice conversation** capabilities with:

- ✅ **Beautiful fluid 3D orb animations**
- ✅ **OpenRouter integration** (100+ AI models)
- ✅ **Medical safety protocols** (FDA/CDSCO drug safety)
- ✅ **Continuous learning** from doctor corrections
- ✅ **Predictive analytics** for proactive alerts
- ✅ **RAG** (Retrieval Augmented Generation) with patient data
- ✅ **Emergency detection** with automatic triage
- ✅ **Multilingual support** (auto-detects language)
- ✅ **Health context awareness** (medications, conditions, wearables)

---

## 🚀 How to Test RIGHT NOW (5 Minutes)

### Step 1: Start Backend Server

```bash
# Open terminal 1
cd backend
npm run start:dev
```

Wait for: `Application started on port 3000`

### Step 2: Start Mobile App

```bash
# Open terminal 2 (don't close terminal 1)
npm start
```

Press:
- `a` for Android
- `i` for iOS

### Step 3: Add Voice Agent to Any Screen

In your app, add this to any screen you want to test:

```typescript
import VoiceAgent from './src/components/VoiceAgent';

// In your screen's render function:
<VoiceAgent 
  onMessage={(msg) => console.log('User:', msg)}
  onResponse={(res) => console.log('AI:', res)}
  onClose={() => navigation.goBack()}
/>
```

### Step 4: Test Conversation

1. Open the screen where you added VoiceAgent
2. Click the **microphone button**
3. Allow microphone permissions
4. Say: **"Hello doctor, I'm not feeling well"**

### Expected Result:

✅ Orb expands and glows (listening state)  
✅ Transcript appears on screen  
✅ AI responds with voice + text  
✅ Orb pulses during speech  
✅ Medical greeting with empathy  

---

## 💬 Example Conversations to Try

### General Consultation

**You:** "Hello doctor, I have a headache"  
**AI:** "Hello! I understand you're experiencing a headache. Let me ask you a few questions to better understand your situation. First, can you tell me when did the headache start?"

**You:** "Since this morning, about 6 hours ago"  
**AI:** "Thank you for that information. A headache lasting 6 hours could have several causes. On a scale of 1 to 10, how would you rate the pain intensity? And are you experiencing any other symptoms like fever, nausea, or sensitivity to light?"

**You:** "About 7 out of 10, and yes I feel nauseous"  
**AI:** "I see. A moderate to severe headache with nausea could be a migraine or tension headache. Let me check if there are any concerns with your current medications. Are you currently taking any prescription medications?"

### Emergency Detection

**You:** "I have chest pain and can't breathe properly"  
**AI:** "⚠️ **EMERGENCY DETECTED** - This appears to be a medical emergency. Please take the following actions immediately: 1. Call 108 (India Emergency Services) or your local emergency number. 2. If someone is with you, ask them to call for help. Do not wait for an AI response. Seek immediate medical attention."

### Multilingual Test

**Hindi:** "नमस्ते डॉक्टर, मुझे तेज बुखार है"  
**AI:** "नमस्ते। मुझे समझ आ रहा है कि आपको परेशानी हो रही है। क्या आप मुझे बता सकते हैं कि आपका बुखार कब से शुरू हुआ? और क्या आपके पास कोई अन्य लक्षण भी हैं जैसे सर्दी, खांसी, या शरीर में दर्द?"

**Telugu:** "నమస్తే డాక్టర్, నాకు పొట్ట నొప్పిగా ఉంది"  
**AI:** "నమస్తే. మీకు అసౌకర్యంగా ఉందని నాకు అర్థమవుతోంది. మీకు పొట్ట నొప్పి ఎక్కడ ఉంది? పైభాగంలో లేదా కింది భాగంలో? మరియు ఇది ఎప్పుడు మొదలైంది?"

### Drug Safety Check

**You:** "Can I take ibuprofen with my other medicines?"  
**AI:** "Let me check your current medications and potential interactions. I see you're taking metformin for diabetes and lisinopril for blood pressure. Ibuprofen can interact with lisinopril and may reduce its effectiveness. It could also affect kidney function, especially when combined with metformin. I'd recommend using acetaminophen (paracetamol) instead for pain relief. Would you like me to suggest some alternatives?"

### Chronic Condition Management

**You:** "My blood sugar has been high lately, around 180-200 mg/dL"  
**AI:** "I notice your blood glucose levels have been elevated. This could be due to several factors - have there been any recent changes in your diet, physical activity, or stress levels? Also, are you taking your metformin regularly as prescribed? Let's work together to bring your levels back to target range."

---

## 🎯 What Makes This Special

### 1. Medical Intelligence

Your backend includes:

- **Drug Safety Checking**: FDA/CDSCO adverse event detection
- **Emergency Triage**: Automatic severity assessment
- **Continuous Learning**: Learns from doctor corrections
- **Predictive Analytics**: Proactive health alerts
- **RAG System**: Access to medical knowledge base
- **Multi-Agent Architecture**: Specialist AI for different conditions

### 2. Personalized Care

The AI knows:
- Your current medications
- Your medical conditions
- Your wearable device data (Fitbit, Garmin, etc.)
- Your past chat history
- Your health trends

### 3. Natural Conversation

- Speaks your language (auto-detects)
- Empathetic, doctor-like tone
- Asks relevant follow-up questions
- Explains in simple terms
- Never diagnoses definitively (uses "could be", "might be")

---

## 🔧 Configuration

### Backend URL (Already Set)

The voice agent automatically uses:
```
http://192.168.3.137:3000/api/chat/message
```

This gives you access to ALL medical features.

### Optional: Direct OpenRouter Mode

If you want to test without backend features:

Create `.env` in project root:
```env
OPENROUTER_API_KEY=your-api-key-here
```

But **using the backend is recommended** for medical conversations!

---

## 🐛 Troubleshooting

### "Cannot connect to backend"

**Check:**
1. Backend is running on port 3000
2. IP address matches your machine (192.168.3.137)
3. Both devices on same Wi-Fi network

**Fix:**
```bash
# In backend folder
npm run start:dev
```

### "No audio response"

**Check:**
1. Phone volume is up
2. TTS permissions granted
3. Backend `/chat/tts` endpoint working

**Test TTS:**
```bash
curl "http://192.168.3.137:3000/chat/tts?text=Hello&token=test"
```

### "Orb not animating"

**Check:**
- Component imported correctly
- No TypeScript errors
- Restart Expo: `npm start -- --clear`

### "Microphone not working"

**Grant permissions:**
- iOS: Settings → Privacy → Microphone
- Android: Settings → Apps → Mediva → Permissions

---

## 📊 What Happens When You Speak

```
1. You speak → Web Speech API converts to text
2. Text sent to VoiceConversationService
3. Service adds system prompt + health context
4. Request sent to OpenRouter (via Mediva backend)
5. Backend runs RAG, drug safety, emergency checks
6. AI generates medically-safe response
7. Response spoken via ElevenLabs TTS
8. Orb animates throughout the conversation
```

### Full Flow Diagram:

```
User Speaks
    ↓
Web Speech API (STT)
    ↓
VoiceConversationService
    ↓
Adds: System Prompt + Health Context
    ↓
Mediva Backend (/api/chat/message)
    ↓
┌─────────────────────────────────┐
│ 1. Emergency Detection          │
│ 2. RAG Context Building         │
│ 3. Drug Safety Check            │
│ 4. Multi-Agent Processing       │
│ 5. Continuous Learning          │
│ 6. Predictive Analytics         │
└─────────────────────────────────┘
    ↓
OpenRouter API (Claude/GPT-4)
    ↓
Medically Safe Response
    ↓
ElevenLabs TTS
    ↓
User Hears Response + Sees Transcript
```

---

## 🎨 The Fluid Orb Animation

The orb has **3 rotating gradient layers** creating a 3D effect:

### States:

| State | Animation | Colors |
|-------|-----------|--------|
| **Idle** | Gentle pulse (breathing) | Green → Blue → Purple |
| **Listening** | Expands to 1.2x, brighter | More green glow |
| **Speaking** | Pulses rhythmically | Cycles through all colors |
| **Processing** | Wobbles/throbs | Thoughtful purple |

### Color Psychology:
- 🟢 **Green**: Healing, calm (medical)
- 🔵 **Blue**: Trust, professional
- 🟣 **Purple**: Wisdom, AI intelligence

---

## ✅ Production Checklist

Before showing to users:

- [ ] Backend running and accessible
- [ ] Microphone permissions working
- [ ] TTS volume appropriate
- [ ] Error messages user-friendly
- [ ] Emergency protocols tested
- [ ] HIPAA compliance considered
- [ ] User consent obtained
- [ ] Offline mode planned
- [ ] Accessibility tested

---

## 🌟 Key Features Summary

### Medical Capabilities:
✅ Emergency symptom detection  
✅ Drug interaction checking  
✅ FDA/CDSCO safety alerts  
✅ Continuous learning from doctors  
✅ Predictive health analytics  
✅ RAG-powered medical knowledge  
✅ Multilingual support (7+ languages)  
✅ Personalized health context  

### Technical Features:
✅ Beautiful fluid 3D animations  
✅ Real-time transcription  
✅ High-quality TTS (ElevenLabs)  
✅ Streaming responses  
✅ Chat history tracking  
✅ Session management  
✅ Health data integration  
✅ Wearable device sync  

---

## 🎯 Next Steps After Testing

### For Production:

1. **Keep Using Backend Mode** - It provides all medical features
2. **Add Error Boundaries** - Handle network failures gracefully
3. **Implement Analytics** - Track usage patterns
4. **A/B Test Models** - Try different AI models via OpenRouter
5. **Add Offline Support** - Cache for poor connectivity

### Enhancements:

1. **Customize System Prompt** - Adjust doctor persona
2. **Add More Languages** - Expand regional coverage
3. **Integrate More Data** - Labs, imaging, genomics
4. **Specialist Modes** - Cardiology, endocrinology, etc.
5. **Family History** - Genetic risk factors

---

## 📞 Quick Reference Commands

### Start Everything:

```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: App
npm start
```

### Test Endpoints:

```bash
# Test chat endpoint
curl -X POST http://192.168.3.137:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello doctor", "sessionId": "test"}'

# Test TTS
curl "http://192.168.3.137:3000/chat/tts?text=Hello"
```

### Check Logs:

```bash
# Backend logs
cd backend
npm run start:dev

# Look for:
# - /api/chat/message requests
# - RAG context building
# - Model selection
# - Response generation
```

---

## 💡 Pro Tips

1. **Test on Device** - Animations smoother than simulator
2. **Use Headphones** - Better audio for testing
3. **Check Backend Logs** - See what AI is processing
4. **Start Simple** - Basic greetings first
5. **Gradually Complex** - Try drug interactions, emergencies last

---

## 🎉 You're Ready!

Everything is set up and ready to test. Just:

1. Start backend (`npm run start:dev`)
2. Start app (`npm start`)
3. Add VoiceAgent component to any screen
4. Click microphone and speak!

The AI will respond like a real doctor - empathetic, knowledgeable, and safety-conscious! 🩺✨

Need help? Check these files:
- `START_HERE_VOICE.md` - Overview
- `VOICE_AGENTS_OVERVIEW.md` - Detailed comparison
- `QUICK_START_VOICE.md` - Integration examples
- `VOICE_AGENT_INTEGRATION.md` - Technical deep dive

Happy testing! 🚀
