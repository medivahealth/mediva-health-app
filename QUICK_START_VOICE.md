# 🚀 Quick Start: Using New Voice Agent in Your App

## Current Status

Your **existing VoiceBotScreen** already has:
- ✅ Beautiful orb animations with gradients
- ✅ Audio recording & playback
- ✅ Streaming responses
- ✅ Multiple language support
- ✅ Settings for voice/language

What's **NEW** from my integration:
- ✅ **OpenRouter API service** (100+ AI models)
- ✅ **Dual-mode operation** (Direct OpenRouter OR Mediva backend)
- ✅ **Enhanced conversation service** with health context
- ✅ **Fluid 3D orb component** (standalone version)

---

## Option A: Use Existing VoiceBotScreen (Recommended)

Your current screen at `src/screens/VoiceBotScreen.tsx` is already production-ready!

### To enhance it with new features:

1. **Add OpenRouter Integration**

Replace line 20-21 in VoiceBotScreen:
```typescript
// OLD:
import voiceService from '../services/voice';
import chatService from '../services/chat';

// NEW:
import { VoiceConversationService } from '../services/voice-conversation';
import chatService from '../services/chat';
```

2. **Initialize New Service**

Add after your state declarations (around line 75):
```typescript
const conversationService = useRef<VoiceConversationService | null>(null);

useEffect(() => {
  if (!conversationService.current) {
    conversationService.current = new VoiceConversationService();
    
    // Add health context if available
    const healthData = {
      medications: ['metformin', 'lisinopril'], // Example
      conditions: ['diabetes', 'hypertension'],
      wearableData: { heartRate: 72, steps: 5420 }
    };
    conversationService.current.setContext({ healthData });
  }
}, []);
```

3. **Use in handleMicPress**

Update the response handling (around line 320):
```typescript
// After getting transcription, also use new service:
if (conversationService.current) {
  const aiResponse = await conversationService.current.sendMessage(transcription);
  // Use aiResponse alongside your existing streaming
}
```

---

## Option B: Use Standalone VoiceAgent Component

For a simpler, self-contained voice interface:

### 1. Add to Any Screen

```typescript
import VoiceAgent from '../components/VoiceAgent';

// In your render:
<VoiceAgent 
  onMessage={(msg) => console.log('User:', msg)}
  onResponse={(res) => console.log('AI:', res)}
  onClose={() => navigation.goBack()}
/>
```

### 2. Full Screen Example

Create `src/screens/SimpleVoiceScreen.tsx`:

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import VoiceAgent from '../components/VoiceAgent';
import { useNavigation } from '@react-navigation/native';

export default function SimpleVoiceScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <VoiceAgent 
        onMessage={(message) => {
          // Save to history, update UI, etc.
          console.log('User said:', message);
        }}
        onResponse={(response) => {
          // Process AI response
          console.log('AI responded:', response);
        }}
        onClose={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});
```

### 3. Add Navigation Route

In your `App.tsx` or navigation config:

```typescript
import SimpleVoiceScreen from './src/screens/SimpleVoiceScreen';

// Add to stack navigator:
<Stack.Screen name="SimpleVoice" component={SimpleVoiceScreen} />
```

---

## Option C: Hybrid Approach (Best of Both)

Use your existing VoiceBotScreen UI but power it with new OpenRouter backend:

### Update VoiceBotScreen.tsx

```typescript
// Add imports
import { VoiceConversationService } from '../services/voice-conversation';
import OpenRouter from '../services/openrouter';

// Add refs
const conversationService = useRef<VoiceConversationService | null>(null);
const openrouter = useRef<OpenRouter | null>(null);

// Initialize in useEffect
useEffect(() => {
  if (!conversationService.current) {
    conversationService.current = new VoiceConversationService();
    openrouter.current = new OpenRouter();
  }
}, []);

// Use in handleMicPress (after transcription)
const handleMicPress = async () => {
  // ... existing recording logic ...
  
  // Get AI response via new service
  if (conversationService.current) {
    try {
      const aiResponse = await conversationService.current.sendMessage(transcription);
      
      // Use response in your existing flow
      enqueueAudio(aiResponse);
      addMessage({ 
        role: 'assistant', 
        content: aiResponse, 
        timestamp: new Date().toISOString() 
      });
    } catch (err) {
      console.error('OpenRouter error:', err);
      // Fallback to existing chatService
    }
  }
};
```

---

## 🔧 Configuration Options

### Mode 1: Direct OpenRouter (Development/Testing)

Create `.env` in project root:
```env
OPENROUTER_API_KEY=your-api-key-here
```

This uses OpenRouter directly without backend features.

### Mode 2: Mediva Backend (Production - Recommended)

No config needed! It automatically uses:
```
http://192.168.3.137:3000/api/chat/message
```

This gives you:
- ✅ Drug safety checking
- ✅ Continuous learning
- ✅ Predictive analytics
- ✅ RAG
- ✅ Health data integration

---

## 📊 Feature Comparison

| Feature | Existing VoiceBot | New VoiceAgent | Hybrid |
|---------|------------------|----------------|------|
| Orb Animation | ✅ Advanced | ✅ Simple 3D | ✅ Use existing |
| Recording | ✅ Native | ⚠️ Needs STT lib | ✅ Use existing |
| TTS | ✅ ElevenLabs | ✅ Expo Speech | ✅ Use existing |
| OpenRouter | ❌ | ✅ | ✅ Add manually |
| Health Context | ⚠️ Partial | ✅ Full | ✅ Add manually |
| Streaming | ✅ Yes | ❌ No | ✅ Use existing |
| Settings UI | ✅ Complete | ❌ Minimal | ✅ Use existing |

**Recommendation**: Keep using your **existing VoiceBotScreen** and optionally add OpenRouter integration to it!

---

## 🎯 Testing Steps

### Test New Services Without Breaking Existing:

1. **Create Test File**

Create `src/test-openrouter.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VoiceConversationService } from './services/voice-conversation';

export default function TestOpenRouter() {
  const [response, setResponse] = useState('');
  const service = new VoiceConversationService();

  const testChat = async () => {
    try {
      const aiResponse = await service.sendMessage('Hello doctor, I have a headache');
      setResponse(aiResponse);
      console.log('AI Response:', aiResponse);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={testChat} style={styles.button}>
        <Text style={styles.text}>Test OpenRouter</Text>
      </TouchableOpacity>
      {response ? <Text style={styles.response}>{response}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  button: { backgroundColor: '#6366f1', padding: 15, borderRadius: 10 },
  text: { color: '#fff', fontSize: 18, textAlign: 'center' },
  response: { marginTop: 20, fontSize: 16 },
});
```

2. **Run Test**
   - Import in App.tsx temporarily
   - Click button
   - Check console for response
   - Remove test when done

---

## 💡 Pro Tips

1. **Don't Reinvent the Wheel** - Your VoiceBotScreen is already excellent!
2. **Add OpenRouter Gradually** - Test with existing flow first
3. **Keep Backend Integration** - It provides valuable medical features
4. **Use New Component for Simple Cases** - Quick prototypes, demos
5. **Monitor Token Usage** - OpenRouter costs ~$0.01 per conversation

---

## 🐛 Common Issues

### "Cannot find module" errors
Make sure TypeScript sees the new files. Restart Expo:
```bash
npm start -- --clear
```

### Backend connection failed
Check IP address matches your machine:
```bash
ipconfig  # Windows
ifconfig  # Mac/Linux
```

Update in `src/services/openrouter.ts` line 12.

### No response from AI
Check backend logs:
```bash
cd backend
npm run start:dev
```

Look for `/api/chat/message` requests.

---

## ✅ Summary

You now have **three options**:

### 1. **Keep Existing** (Safest)
   - VoiceBotScreen works perfectly as-is
   - No changes needed

### 2. **Enhance Existing** (Recommended)
   - Add OpenRouter service to VoiceBotScreen
   - Keep all current features
   - Gain new AI capabilities

### 3. **Use Standalone** (For Simplicity)
   - Use VoiceAgent component separately
   - Simpler but loses some features
   - Good for demos/prototypes

**My Recommendation**: Option 2 - Enhance your existing VoiceBotScreen with the new OpenRouter integration! 🎉

Need help integrating? Just ask! 😊
