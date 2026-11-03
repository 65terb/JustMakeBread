import type { CampaignConfig } from './CampaignConfig';
import type { Module } from './objects/Module';
import type { ProductionBlock } from './objects/ProductionBlock';

export type ProductionModifiers = Readonly<{ processingSpeedMultiplier: number; outputCount: number }>;
const modifierCache = new WeakMap<ProductionBlock, { processingSpeedMultiplier: number; outputCount: number }>();

function readPhaseActiveDuration(startPhase: number, deltaSeconds: number, activeDuration: number, cycleDuration: number): number {
  const wholeCycles = Math.floor(deltaSeconds / cycleDuration);
  let result = wholeCycles * activeDuration;
  let remaining = deltaSeconds - wholeCycles * cycleDuration;
  const beforeWrap = Math.min(remaining, cycleDuration - startPhase);
  result += Math.max(0, Math.min(startPhase + beforeWrap, activeDuration) - Math.min(startPhase, activeDuration));
  remaining -= beforeWrap;
  if (remaining > 0) result += Math.min(remaining, activeDuration);
  return result;
}

export function advanceModuleEffects(modules: readonly Module[], deltaSeconds: number, config: CampaignConfig,
  isActivelyProcessing: (block: ProductionBlock) => boolean = (block) => block.storedMaterialIds.length > 0): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  let fastActiveSeconds = 0;
  const fast = modules.find((module) => module.type === 'fast');
  if (fast !== undefined && fast.location.kind !== 'not-introduced') {
    const maxFuel = config.modules.fast.maxFuelSeconds;
    const recoveryDuration = config.modules.fast.recoverySeconds;
    const recoveryRate = maxFuel / recoveryDuration;
    const canAccelerate = fast.location.kind === 'socket' && !fast.presentationLocked && isActivelyProcessing(fast.location.block);
    if (canAccelerate) {
      const cycleDuration = maxFuel + recoveryDuration;
      const phaseSeconds = fast.recoverySeconds > 0
        ? maxFuel + (recoveryDuration - fast.recoverySeconds)
        : maxFuel - fast.fuelSeconds;
      fastActiveSeconds = readPhaseActiveDuration(phaseSeconds, deltaSeconds, maxFuel, cycleDuration);
      const nextPhase = (phaseSeconds + deltaSeconds) % cycleDuration;
      if (nextPhase < maxFuel) {
        fast.fuelSeconds = maxFuel - nextPhase;
        fast.recoverySeconds = 0;
      } else {
        const recoveryElapsed = nextPhase - maxFuel;
        fast.fuelSeconds = recoveryRate * recoveryElapsed;
        fast.recoverySeconds = recoveryDuration - recoveryElapsed;
      }
    } else if (fast.fuelSeconds < maxFuel) {
      if (fast.recoverySeconds <= 0) fast.recoverySeconds = config.modules.fast.recoverySeconds *
        (1 - fast.fuelSeconds / maxFuel);
      fast.fuelSeconds = Math.min(maxFuel, fast.fuelSeconds + recoveryRate * deltaSeconds);
      fast.recoverySeconds = Math.max(0, fast.recoverySeconds - deltaSeconds);
      if (fast.fuelSeconds === maxFuel) fast.recoverySeconds = 0;
    }
  }
  const double = modules.find((module) => module.type === 'double');
  if (double !== undefined && double.location.kind !== 'not-introduced') {
    let remainingSeconds = deltaSeconds;
    const chargeDuration = config.modules.double.chargeSeconds;
    const activeDuration = config.modules.double.activeSeconds;
    const cycleDuration = chargeDuration + activeDuration;
    while (remainingSeconds > 0) {
      if (double.activeSeconds > 0) {
        const consumed = Math.min(double.activeSeconds, remainingSeconds);
        double.advanceDoubleActiveFeedbackEnvelope(true, consumed, config);
        double.activeSeconds -= consumed; remainingSeconds -= consumed;
        if (double.activeSeconds > 0) break;
        double.activeSeconds = 0;
        continue;
      }
      if (double.chargeSeconds === 0 && remainingSeconds >= cycleDuration) {
        const wholeCycles = Math.floor(remainingSeconds / cycleDuration);
        if (wholeCycles > 0) {
          double.advanceDoubleActiveFeedbackEnvelope(false, chargeDuration, config);
          double.advanceDoubleActiveFeedbackEnvelope(true, activeDuration, config);
          remainingSeconds -= wholeCycles * cycleDuration;
        }
        if (remainingSeconds === 0) break;
      }
      const chargeRemaining = chargeDuration - double.chargeSeconds;
      const charged = Math.min(chargeRemaining, remainingSeconds);
      double.advanceDoubleActiveFeedbackEnvelope(false, charged, config);
      if (remainingSeconds < chargeRemaining) {
        double.chargeSeconds += charged;
        break;
      }
      remainingSeconds -= charged;
      double.chargeSeconds = 0;
      double.activeSeconds = activeDuration;
    }
  }
  return fastActiveSeconds;
}

export function readFastActiveProcessingMultiplier(block: ProductionBlock, config: CampaignConfig): number {
  const fastAttached = block.sockets.some((socket) => socket.module?.type === 'fast' && socket.module.presentationLocked === false);
  if (!fastAttached) return 1;
  const againAttached = block.sockets.some((socket) => socket.module?.type === 'again' && socket.module.presentationLocked === false);
  return Math.pow(config.modules.fast.processingSpeedMultiplier, againAttached ? 1 + config.modules.again.fastReapplicationCount : 1);
}

export function readProductionModifiers(block: ProductionBlock, config: CampaignConfig): ProductionModifiers {
  const fast = block.sockets.find((socket) => socket.module?.type === 'fast' && socket.module.presentationLocked === false)?.module ?? null;
  const againAttached = block.sockets.some((socket) => socket.module?.type === 'again' && socket.module.presentationLocked === false);
  const processingSpeedMultiplier = fast !== null && fast.fuelSeconds > 0 && fast.recoverySeconds === 0
    ? readFastActiveProcessingMultiplier(block, config)
    : 1;
  const double = block.sockets.find((socket) => socket.module?.type === 'double' && socket.module.presentationLocked === false)?.module ?? null;
  const outputCount = double !== null && double.activeSeconds > 0
    ? (againAttached ? config.modules.double.outputMultiplier * config.modules.again.doubleOutputMultiplier : config.modules.double.outputMultiplier)
    : 1;
  let result = modifierCache.get(block); if (result === undefined) { result = { processingSpeedMultiplier, outputCount }; modifierCache.set(block, result); }
  result.processingSpeedMultiplier = processingSpeedMultiplier; result.outputCount = outputCount; return result;
}
