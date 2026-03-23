import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';
import { RagContext } from './rag.service';

export type AgentType = 
  | 'general_medical'      // General health questions
  | 'symptom_analyzer'     // Symptom analysis and triage
  | 'chronic_care'         // Chronic disease management
  | 'mental_health'        // Mental health and wellness
  | 'pediatric'            // Children's health
  | 'women_health'         // Women's health and gynecology
  | 'cardiovascular'       // Heart and cardiovascular
  | 'emergency_triage';    // Emergency assessment

export interface AgentResponse {
  agent: AgentType;
  response: string;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class MultiAgentService {
  private readonly logger = new Logger(MultiAgentService.name);

  constructor(private openRouter: OpenRouterService) {}

  /**
   * Select the best agent(s) for a given query
   */
  async selectAgent(query: string, context: RagContext): Promise<AgentType[]> {
    const selectionPrompt = `You are an agent selector for a multi-agent medical AI system. Analyze the query and select the most appropriate specialized agent(s).

Query: "${query}"

Available Agents:
1. general_medical - General health questions, wellness, preventive care
2. symptom_analyzer - Symptom analysis, triage, "what could this be?"
3. chronic_care - Diabetes, hypertension, chronic disease management
4. mental_health - Anxiety, depression, stress, mental wellness
5. pediatric - Children's health (ages 0-18)
6. women_health - Women's health, gynecology, pregnancy, reproductive health
7. cardiovascular - Heart health, blood pressure, cardiac conditions
8. emergency_triage - Emergency situations, urgent care assessment

Patient Context:
${context.healthHistory ? `Health History: ${context.healthHistory}` : 'No health history'}
${context.patientRecords ? `Medical Records: ${context.patientRecords.substring(0, 500)}` : 'No medical records'}

Respond with ONLY a JSON array of agent names (1-3 agents max), ordered by priority:
["agent_name_1", "agent_name_2"]`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: selectionPrompt }],
        ModelTier.FAST,
        { temperature: 0.2, maxTokens: 150 },
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const agents = JSON.parse(jsonMatch[0]);
        return agents.filter((a: string) => 
          ['general_medical', 'symptom_analyzer', 'chronic_care', 'mental_health', 
           'pediatric', 'women_health', 'cardiovascular', 'emergency_triage'].includes(a)
        );
      }
    } catch (err) {
      this.logger.warn('Agent selection failed:', err);
    }

    // Fallback: Use general medical agent
    return ['general_medical'];
  }

  /**
   * Get specialized system prompt for an agent
   */
  getAgentSystemPrompt(agent: AgentType, basePrompt: string): string {
    const agentSpecializations: Record<AgentType, string> = {
      general_medical: `You are a GENERAL PRACTITIONER with expertise in:
- Preventive medicine and wellness
- General health questions
- Common illnesses and their management
- Health education and lifestyle advice
- Coordinating care across specialties`,

      symptom_analyzer: `You are a SYMPTOM ANALYZER and TRIAGE SPECIALIST with expertise in:
- Analyzing symptoms and their possible causes
- Determining urgency and severity
- Differential diagnosis (considering multiple possibilities)
- When to seek immediate care vs. self-care
- Red flag symptoms that require urgent attention`,

      chronic_care: `You are a CHRONIC DISEASE MANAGEMENT SPECIALIST with expertise in:
- Diabetes management (Type 1, Type 2, gestational)
- Hypertension and cardiovascular risk management
- Chronic kidney disease
- Asthma and COPD
- Arthritis and autoimmune conditions
- Long-term medication management and monitoring`,

      mental_health: `You are a MENTAL HEALTH SPECIALIST with expertise in:
- Anxiety disorders and panic attacks
- Depression and mood disorders
- Stress management
- Sleep disorders
- Trauma and PTSD
- When to seek professional mental health support`,

      pediatric: `You are a PEDIATRICIAN with expertise in:
- Children's health (newborn to 18 years)
- Growth and development milestones
- Childhood illnesses and vaccinations
- Pediatric medication dosing
- Age-appropriate health advice`,

      women_health: `You are a WOMEN'S HEALTH SPECIALIST with expertise in:
- Gynecological health
- Menstrual health and disorders
- Pregnancy and prenatal care
- Menopause
- Reproductive health
- Breast health`,

      cardiovascular: `You are a CARDIOLOGIST with expertise in:
- Heart health and cardiovascular disease
- Blood pressure management
- Heart rhythm disorders
- Cardiac risk factors
- Exercise and heart health
- Cardiac medications`,

      emergency_triage: `You are an EMERGENCY MEDICINE SPECIALIST with expertise in:
- Rapid assessment of emergency situations
- Life-threatening conditions
- When to call 108 or visit ER immediately
- First aid and immediate interventions
- Stabilization advice before reaching hospital`,
    };

    const specialization = agentSpecializations[agent] || agentSpecializations.general_medical;

    return `${basePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGENT SPECIALIZATION: ${agent.toUpperCase().replace(/_/g, ' ')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${specialization}

You should provide responses that reflect your specialized expertise while maintaining the overall Mediva AI standards of evidence-based, empathetic care.`;
  }

  /**
   * Get response from multiple agents and synthesize
   */
  async getMultiAgentResponse(
    query: string,
    selectedAgents: AgentType[],
    baseSystemPrompt: string,
    conversationHistory: any[],
  ): Promise<string> {
    if (selectedAgents.length === 1) {
      // Single agent - use directly
      const agentPrompt = this.getAgentSystemPrompt(selectedAgents[0], baseSystemPrompt);
      const messages = [
        { role: 'system', content: agentPrompt },
        ...conversationHistory,
      ];
      return await this.openRouter.chat(messages, ModelTier.REASONING);
    }

    // Multiple agents - get responses from each and synthesize
    const agentResponses: AgentResponse[] = [];

    for (const agent of selectedAgents) {
      try {
        const agentPrompt = this.getAgentSystemPrompt(agent, baseSystemPrompt);
        const messages = [
          { role: 'system', content: agentPrompt },
          ...conversationHistory,
        ];
        const response = await this.openRouter.chat(messages, ModelTier.FAST);
        
        agentResponses.push({
          agent,
          response,
          confidence: 0.8, // Could be improved with confidence scoring
          reasoning: `Specialized ${agent} perspective`,
        });
      } catch (err) {
        this.logger.warn(`Agent ${agent} failed:`, err);
      }
    }

    // Synthesize multiple agent responses
    if (agentResponses.length === 0) {
      return 'I apologize, but I encountered an error processing your question. Please try again.';
    }

    if (agentResponses.length === 1) {
      return agentResponses[0].response;
    }

    // Synthesize multiple perspectives
    const synthesisPrompt = `You are synthesizing responses from multiple specialized medical agents to provide a comprehensive answer.

Original Query: "${query}"

Agent Responses:
${agentResponses.map((ar, i) => `
Agent ${i + 1} (${ar.agent}):
${ar.response}
`).join('\n---\n')}

Synthesize these responses into a single, comprehensive, well-structured answer that:
1. Combines the best insights from each agent
2. Resolves any contradictions
3. Provides a unified, coherent response
4. Maintains citations and evidence
5. Follows the Mediva AI response format`;

    return await this.openRouter.chat(
      [{ role: 'user', content: synthesisPrompt }],
      ModelTier.REASONING,
    );
  }
}
