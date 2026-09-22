/**
 * ==============================================================================
 * MAESTRO COOLER - CLIENT-SIDE AI THERMAL INFERENCE ENGINE
 * Pure client-side Random Forest Classifier evaluator.
 * Evaluates 50 decision trees in browser with 0ms latency.
 * Offline capable. Zero cloud/backend requirement.
 * 
 * Strict Engineering Integrity:
 * - If model weights are not loaded: displays "MODEL NOT TRAINED".
 * - NO fake dataset, NO fake accuracy, NO fake confidence.
 * ==============================================================================
 */

'use strict';

class MaestroAiEngine {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.modelStatus = 'MODEL NOT TRAINED'; // 'MODEL NOT TRAINED' | 'TRAINED'
    this.modelMetadata = {
      algorithm: 'Random Forest',
      trees: 50,
      features: 8,
      classes: '5V / 9V / 12V',
      datasetSamples: 0,
      accuracy: null
    };

    // AI Runtime State
    this.enabled = false;
    this.lastPredictionTime = 0;
    this.predictionIntervalMs = 2000; // 2 seconds inference tick

    // Anti-Oscillation & Smoothing Configuration
    this.minHoldTimeMs = 6000;       // Minimum 6 seconds in a mode before switching
    this.lastModeChangeTime = 0;
    this.pendingPredictionMode = null;
    this.consecutiveConfirmationCount = 0;
    this.requiredConfirmations = 2;   // Must confirm 2 consecutive ticks before mode shift

    // AI Decision History & Statistics
    this.decisionCounts = { 5: 0, 9: 0, 12: 0 };
    this.totalDecisions = 0;
    this.aiSessionStartTime = null;

    // Feature Definitions (Must match ai/train_model.py exactly)
    this.featureNames = [
      'coldTemp',
      'hotTemp',
      'coldTempRate',
      'hotTempRate',
      'currentFanMode',
      'coolingDuration',
      'previousColdTemp',
      'previousHotTemp'
    ];

    // Attempt to load model on initialization
    this.loadModel();
  }

  /**
   * Load model weights JSON exported by ai/train_model.py
   */
  async loadModel() {
    try {
      const response = await fetch('js/model_weights.json', { cache: 'no-cache' });
      if (!response.ok) {
        this._setUntrainedStatus();
        return false;
      }

      const data = await response.json();
      if (!data || !data.trees || data.trees.length === 0) {
        this._setUntrainedStatus();
        return false;
      }

      this.model = data;
      this.isModelLoaded = true;
      this.modelStatus = 'TRAINED';
      this.modelMetadata = {
        algorithm: data.algorithm || 'Random Forest',
        trees: data.trees.length,
        features: data.feature_names ? data.feature_names.length : 8,
        classes: '5V / 9V / 12V',
        datasetSamples: data.dataset_samples || 0,
        accuracy: data.test_accuracy !== undefined ? data.test_accuracy : null
      };

      console.log(`[Maestro AI] Random Forest Model loaded! Trees: ${data.trees.length}, Accuracy: ${this.modelMetadata.accuracy}%`);
      return true;
    } catch (err) {
      // Model not yet trained or file not found - perfectly normal before first training
      this._setUntrainedStatus();
      return false;
    }
  }

  _setUntrainedStatus() {
    this.model = null;
    this.isModelLoaded = false;
    this.modelStatus = 'MODEL NOT TRAINED';
    this.modelMetadata.accuracy = null;
    this.modelMetadata.datasetSamples = 0;
    console.log('[Maestro AI] Status: MODEL NOT TRAINED. Waiting for user training pipeline.');
  }

  /**
   * Run local inference on a single decision tree
   * @param {Object} tree Serialized Decision Tree
   * @param {Array<number>} features 8-dimensional feature vector
   * @returns {Array<number>} Class probabilities for this tree
   */
  _evaluateTree(tree, features) {
    let node = 0;
    while (tree.children_left[node] !== -1 && tree.children_right[node] !== -1) {
      const featIndex = tree.feature[node];
      const threshold = tree.threshold[node];
      const val = features[featIndex];

      if (val <= threshold) {
        node = tree.children_left[node];
      } else {
        node = tree.children_right[node];
      }
    }
    return tree.values[node];
  }

  /**
   * Pure Random Forest inference on 8-feature vector.
   * Returns prediction and exact confidence percentage via ensemble tree voting.
   * @param {Object} telemetry Dual NTC telemetry object
   * @returns {Object|null}
   */
  predictFanMode(telemetry) {
    if (!this.isModelLoaded || !this.model) {
      return null; // Strict engineering integrity: do not fabricate prediction
    }

    if (!telemetry || telemetry.coldTemp === null || telemetry.coldTemp === undefined) {
      return null;
    }

    // 1. Build 8-dimensional feature vector
    const coldTemp = Number(telemetry.coldTemp);
    const hotTemp = telemetry.hotTemp !== null && telemetry.hotTemp !== undefined ? Number(telemetry.hotTemp) : coldTemp + 15.0;
    const coldTempRate = Number(telemetry.coldTempRate || 0);
    const hotTempRate = Number(telemetry.hotTempRate || 0);
    const currentFanMode = Number(telemetry.fanMode || 12);
    const coolingDuration = Number(telemetry.coolingDuration || 0);
    const previousColdTemp = telemetry.previousColdTemp !== null && telemetry.previousColdTemp !== undefined ? Number(telemetry.previousColdTemp) : coldTemp;
    const previousHotTemp = telemetry.previousHotTemp !== null && telemetry.previousHotTemp !== undefined ? Number(telemetry.previousHotTemp) : hotTemp;

    const features = [
      coldTemp,
      hotTemp,
      coldTempRate,
      hotTempRate,
      currentFanMode,
      coolingDuration,
      previousColdTemp,
      previousHotTemp
    ];

    // 2. Ensemble Voting across all trees
    const classes = this.model.classes; // [5, 9, 12]
    const classProbSums = new Array(classes.length).fill(0);

    for (let i = 0; i < this.model.trees.length; i++) {
      const treeProbs = this._evaluateTree(this.model.trees[i], features);
      for (let c = 0; c < classes.length; c++) {
        classProbSums[c] += treeProbs[c];
      }
    }

    // 3. Normalize to probabilities
    const numTrees = this.model.trees.length;
    let bestClassIndex = 0;
    let maxProb = 0;

    const probabilities = classProbSums.map((sum, idx) => {
      const prob = sum / numTrees;
      if (prob > maxProb) {
        maxProb = prob;
        bestClassIndex = idx;
      }
      return prob;
    });

    const predictedMode = classes[bestClassIndex];
    const confidence = Math.round(maxProb * 100);

    // 4. Generate Explainable AI Reasoning (Local feature analysis)
    const reason = this._generateExplanation(features, predictedMode);

    return {
      mode: predictedMode,
      confidence: confidence,
      probabilities: probabilities,
      features: features,
      reason: reason
    };
  }

  /**
   * Generates deterministic, explainable thermal reason based on telemetry features.
   */
  _generateExplanation(features, predictedMode) {
    const [coldTemp, hotTemp, coldTempRate, hotTempRate] = features;

    if (predictedMode === 12) {
      if (hotTemp >= 52.0) {
        return "Heatsink hot-side elevated; maximum airflow required to sustain Peltier delta-T.";
      }
      if (coldTempRate > 0.4 || hotTempRate > 0.4) {
        return "Thermal derivative indicates rising cold and hot temperature trends.";
      }
      if (coldTemp > 24.0) {
        return "High thermal load on smartphone plate; prioritizing rapid heat extraction.";
      }
      return "Heavy workload detected; Turbo 12V engaged for optimal cooling headroom.";
    }

    if (predictedMode === 9) {
      if (coldTemp <= 18.0 && coldTempRate <= 0.2) {
        return "Plate temperature within stable target zone; Balanced mode active for noise/efficiency ratio.";
      }
      if (hotTemp < 45.0) {
        return "Heatsink heat dissipation stabilized under moderate fan RPM.";
      }
      return "Thermal conditions balanced; maintaining steady cooling pressure.";
    }

    // predictedMode === 5
    if (coldTemp < 13.0 && hotTemp < 38.0) {
      return "Cold plate is deeply chilled and heatsink is cool; Silent 5V engaged to save power and minimize acoustic noise.";
    }
    return "Light thermal workload; maintaining low acoustic profile.";
  }

  /**
   * Anti-Oscillation & Smoothing Dispatcher.
   * Prevents rapid back-and-forth flapping between 5V / 9V / 12V.
   * @param {Object} aiDecision Output from predictFanMode()
   * @param {number} currentActiveMode Currently running fan mode in hardware
   * @returns {number|null} Fan mode to send to ESP32 (null if no change or locked)
   */
  filterAndStabilizeDecision(aiDecision, currentActiveMode) {
    if (!aiDecision) return null;

    const rawPrediction = aiDecision.mode;
    const now = Date.now();

    // 1. Record Decision Statistics
    if (this.decisionCounts[rawPrediction] !== undefined) {
      this.decisionCounts[rawPrediction]++;
      this.totalDecisions++;
    }

    // If prediction matches current active mode, reset pending candidate
    if (rawPrediction === currentActiveMode) {
      this.pendingPredictionMode = null;
      this.consecutiveConfirmationCount = 0;
      return null;
    }

    // 2. Minimum Hold-Down Time: Do not change if mode changed recently
    if (now - this.lastModeChangeTime < this.minHoldTimeMs) {
      return null;
    }

    // 3. Consecutive Prediction Confirmation
    if (this.pendingPredictionMode === rawPrediction) {
      this.consecutiveConfirmationCount++;
    } else {
      this.pendingPredictionMode = rawPrediction;
      this.consecutiveConfirmationCount = 1;
    }

    // Only commit change if confirmed over consecutive intervals
    if (this.consecutiveConfirmationCount >= this.requiredConfirmations) {
      this.lastModeChangeTime = now;
      this.pendingPredictionMode = null;
      this.consecutiveConfirmationCount = 0;
      return rawPrediction;
    }

    return null;
  }

  /**
   * Start AI Session Tracking
   */
  startSession() {
    this.enabled = true;
    this.aiSessionStartTime = Date.now();
  }

  /**
   * Stop AI Session Tracking
   */
  stopSession() {
    this.enabled = false;
    this.pendingPredictionMode = null;
    this.consecutiveConfirmationCount = 0;
  }

  /**
   * Get AI Session Statistics for Statistics Tab
   */
  getSessionStatistics() {
    const durationMinutes = this.aiSessionStartTime
      ? Math.round((Date.now() - this.aiSessionStartTime) / 60000)
      : 0;

    const total = this.totalDecisions > 0 ? this.totalDecisions : 1;
    const pct5 = Math.round((this.decisionCounts[5] / total) * 100);
    const pct9 = Math.round((this.decisionCounts[9] / total) * 100);
    const pct12 = Math.round((this.decisionCounts[12] / total) * 100);

    return {
      durationMinutes,
      pct5,
      pct9,
      pct12,
      totalDecisions: this.totalDecisions
    };
  }
}

// Global Singleton instance
window.maestroAi = new MaestroAiEngine();
