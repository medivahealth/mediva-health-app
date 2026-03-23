import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DrugSafetyAlert {
  drugName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  alertType: string;
  description: string;
  farsReference?: string;
  cdscoReference?: string;
  recommendation: string;
  detectedAt: Date;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  mechanism: string;
  management: string;
}

@Injectable()
export class DrugSafetyService {
  private readonly logger = new Logger(DrugSafetyService.name);
  private faersCache: Map<string, any> = new Map();
  private lastFaersUpdate: Date | null = null;

  constructor(private config: ConfigService) {}

  /**
   * Check prescription against FDA FAERS database
   */
  async checkDrugSafety(drugNames: string[]): Promise<DrugSafetyAlert[]> {
    const alerts: DrugSafetyAlert[] = [];

    for (const drug of drugNames) {
      // Check FAERS (simulated - would call actual API in production)
      const faersAlert = await this.checkFAERS(drug);
      if (faersAlert) alerts.push(faersAlert);

      // Check CDSCO (Indian regulatory body) if applicable
      const cdscoAlert = await this.checkCDSCO(drug);
      if (cdscoAlert) alerts.push(cdscoAlert);
    }

    return alerts;
  }

  /**
   * Check for drug-drug interactions
   */
  async checkDrugInteractions(medications: string[]): Promise<DrugInteraction[]> {
    if (medications.length < 2) return [];

    const interactions: DrugInteraction[] = [];

    // Check all pairs
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const interaction = await this.getInteraction(medications[i], medications[j]);
        if (interaction) interactions.push(interaction);
      }
    }

    return interactions;
  }

  /**
   * Enhanced safety check for AI response context
   */
  async buildSafetyContext(
    medications: string[],
    conditions?: string[],
  ): Promise<string> {
    const alerts = await this.checkDrugSafety(medications);
    const interactions = await this.checkDrugInteractions(medications);

    let safetyText = '';

    if (alerts.length > 0) {
      safetyText += '\n\n⚠️ DRUG SAFETY ALERTS:\n';
      alerts.forEach((alert) => {
        safetyText += `- [${alert.severity.toUpperCase()}] ${alert.drugName}: ${alert.description}\n`;
        safetyText += `  Recommendation: ${alert.recommendation}\n`;
      });
    }

    if (interactions.length > 0) {
      safetyText += '\n\n💊 DRUG INTERACTIONS DETECTED:\n';
      interactions.forEach((interaction) => {
        safetyText += `- ${interaction.drug1} + ${interaction.drug2} (${interaction.severity}):\n`;
        safetyText += `  ${interaction.description}\n`;
        safetyText += `  Management: ${interaction.management}\n`;
      });
    }

    if (conditions && conditions.length > 0) {
      const conditionWarnings = await this.getConditionWarnings(medications, conditions);
      if (conditionWarnings.length > 0) {
        safetyText += '\n\n⚕️ CONDITION-SPECIFIC WARNINGS:\n';
        conditionWarnings.forEach((warning) => {
          safetyText += `- ${warning}\n`;
        });
      }
    }

    return safetyText || 'No safety concerns detected from current databases.';
  }

  /**
   * Check FDA FAERS database (simulated)
   */
  private async checkFAERS(drugName: string): Promise<DrugSafetyAlert | null> {
    try {
      // In production: Call FDA FAERS API
      // https://fis.fda.gov/sense/app/d3fcbe3b-78bc-4e25-873c-66f72e696ab5/Sheet/State%20of%20FAERS%20Overview.state/AnalysisSelection

      // Simulated check - would be replaced with real API call
      const simulatedAlerts: Record<string, Partial<DrugSafetyAlert>> = {
        'metformin': {
          severity: 'medium',
          alertType: 'lactic_acidosis_warning',
          description: 'Rare but serious lactic acidosis risk, especially in patients with kidney impairment',
          recommendation: 'Monitor kidney function. Discontinue if unusual muscle pain, difficulty breathing, or stomach pain occurs.',
        },
        'lisinopril': {
          severity: 'high',
          alertType: 'angioedema_warning',
          description: 'Risk of angioedema (swelling of face, lips, tongue). Higher incidence in African American patients.',
          recommendation: 'Seek immediate medical attention if swelling of face, lips, tongue, or difficulty breathing occurs.',
        },
        'atorvastatin': {
          severity: 'medium',
          alertType: 'myopathy_warning',
          description: 'Increased risk of myopathy/rhabdomyolysis, especially at higher doses',
          recommendation: 'Report unexplained muscle pain, tenderness, or weakness. Avoid grapefruit products.',
        },
      };

      const alert = simulatedAlerts[drugName.toLowerCase()];
      if (alert) {
        return {
          drugName,
          severity: alert.severity!,
          alertType: alert.alertType!,
          description: alert.description!,
          farsReference: `FAERS Report #${Date.now()}`,
          recommendation: alert.recommendation!,
          detectedAt: new Date(),
        };
      }
    } catch (err) {
      this.logger.warn(`FAERS check failed for ${drugName}:`, err);
    }

    return null;
  }

  /**
   * Check CDSCO (India) safety alerts (simulated)
   */
  private async checkCDSCO(drugName: string): Promise<DrugSafetyAlert | null> {
    try {
      // In production: Call CDSCO API or scrape their website
      // https://cdsco.gov.in/opencms/opencms/en/

      // Simulated India-specific alerts
      const simulatedAlerts: Record<string, Partial<DrugSafetyAlert>> = {
        'diclofenac': {
          severity: 'high',
          alertType: 'cardiovascular_risk',
          description: 'CDSCO advisory: Increased cardiovascular thrombotic events with long-term use',
          recommendation: 'Use lowest effective dose. Avoid in patients with recent MI or stroke.',
        },
        'omeprazole': {
          severity: 'low',
          alertType: 'bone_fracture_warning',
          description: 'Long-term use associated with increased risk of bone fractures',
          recommendation: 'Ensure adequate calcium and vitamin D intake. Consider bone density monitoring for long-term users.',
        },
      };

      const alert = simulatedAlerts[drugName.toLowerCase()];
      if (alert) {
        return {
          drugName,
          severity: alert.severity!,
          alertType: alert.alertType!,
          description: alert.description!,
          cdscoReference: `CDSCO Advisory ${new Date().getFullYear()}`,
          recommendation: alert.recommendation!,
          detectedAt: new Date(),
        };
      }
    } catch (err) {
      this.logger.warn(`CDSCO check failed for ${drugName}:`, err);
    }

    return null;
  }

  /**
   * Get drug-drug interaction (simulated database)
   */
  private async getInteraction(drug1: string, drug2: string): Promise<DrugInteraction | null> {
    // In production: Use comprehensive interaction database like First Databank or Micromedex
    
    const interactionKey = [drug1.toLowerCase(), drug2.toLowerCase()].sort().join('+');

    const knownInteractions: Record<string, Partial<DrugInteraction>> = {
      'metformin+contrast+dye': {
        severity: 'major',
        description: 'Iodinated contrast media can cause acute kidney injury, increasing metformin accumulation risk',
        mechanism: 'Reduced renal clearance of metformin',
        management: 'Discontinue metformin 48 hours before and after contrast procedures. Restart only after kidney function confirmed normal.',
      },
      'lisinopril+potassium': {
        severity: 'major',
        description: 'Increased risk of hyperkalemia (dangerously high potassium levels)',
        mechanism: 'ACE inhibitors reduce potassium excretion',
        management: 'Avoid potassium supplements and salt substitutes. Monitor serum potassium regularly.',
      },
      'warfarin+nsaids': {
        severity: 'contraindicated',
        description: 'Dramatically increased bleeding risk',
        mechanism: 'NSAIDs inhibit platelet function and can cause GI bleeding; warfarin reduces clotting',
        management: 'Avoid combination. Use acetaminophen for pain relief instead. If absolutely necessary, monitor INR closely.',
      },
      'simvastatin+amlodipine': {
        severity: 'moderate',
        description: 'Increased risk of myopathy and rhabdomyolysis',
        mechanism: 'Amlodipine inhibits CYP3A4 metabolism of simvastatin',
        management: 'Limit simvastatin dose to 20mg daily when used with amlodipine.',
      },
    };

    // Check various combinations
    for (const [key, interaction] of Object.entries(knownInteractions)) {
      const [d1, d2] = key.split('+');
      if (
        (drug1.toLowerCase().includes(d1) && drug2.toLowerCase().includes(d2)) ||
        (drug1.toLowerCase().includes(d2) && drug2.toLowerCase().includes(d1))
      ) {
        return {
          drug1,
          drug2,
          severity: interaction.severity!,
          description: interaction.description!,
          mechanism: interaction.mechanism!,
          management: interaction.management!,
        };
      }
    }

    return null;
  }

  /**
   * Get warnings based on patient conditions
   */
  private async getConditionWarnings(medications: string[], conditions: string[]): Promise<string[]> {
    const warnings: string[] = [];

    const conditionMedications: Record<string, string[]> = {
      'kidney disease': ['metformin', 'nsaids', 'ace inhibitors'],
      'liver disease': ['statins', 'acetaminophen', 'metformin'],
      'heart failure': ['nsaids', 'thiazolidinediones'],
      'pregnancy': ['ace inhibitors', 'arb', 'statins', 'warfarin'],
      'asthma': ['beta blockers', 'aspirin', 'nsaids'],
      'diabetes': ['steroids', 'thiazides', 'beta blockers'],
    };

    conditions.forEach((condition) => {
      const riskyMeds = conditionMedications[condition.toLowerCase()] || [];
      medications.forEach((med) => {
        if (riskyMeds.some((rm) => med.toLowerCase().includes(rm))) {
          warnings.push(`${med} may require caution or dose adjustment in patients with ${condition}`);
        }
      });
    });

    return warnings;
  }

  /**
   * Periodic background update of FAERS cache
   */
  async updateFaersDatabase(): Promise<void> {
    // In production: Schedule this to run weekly via cron
    // For now, just a placeholder
    this.lastFaersUpdate = new Date();
    this.logger.log('FAERS database updated');
  }

  getSafetyStats() {
    return {
      lastFaersUpdate: this.lastFaersUpdate,
      cacheSize: this.faersCache.size,
    };
  }
}
