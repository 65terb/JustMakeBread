import type { CampaignEvent } from './CampaignState';

export type CampaignAudioCue =
  | 'material-pickup' | 'material-drop' | 'material-intake' | 'process-start' | 'process-complete' | 'material-output'
  | 'bread-submitted' | 'stage-clear' | 'game-over'
  | 'module-reveal' | 'module-pickup' | 'module-attach' | 'module-detach' | 'module-drop';
export interface CampaignAudioSettings { readonly volume: number; readonly muted: boolean }
interface LegacyCampaignAudioSettings { readonly masterVolume: number; readonly masterMuted: boolean }
const STORAGE_KEY = 'just-make-bread.audio-settings.v1';
type ApprovedCue = 'material-pickup' | 'bread-submitted' | 'stage-clear';
type AudioPriority = 'p0' | 'p1';
const APPROVED_CUES: Readonly<Record<ApprovedCue, Readonly<{
  readonly gainDb: number; readonly priority: AudioPriority; readonly concurrencyGroup: 'material-action' | 'deposit' | 'priority'; readonly cooldownMs: 0;
}>>> = Object.freeze({
  'material-pickup': Object.freeze({ gainDb: -10, priority: 'p1', concurrencyGroup: 'material-action', cooldownMs: 0 }),
  'bread-submitted': Object.freeze({ gainDb: 0, priority: 'p1', concurrencyGroup: 'deposit', cooldownMs: 0 }),
  'stage-clear': Object.freeze({ gainDb: 0, priority: 'p0', concurrencyGroup: 'priority', cooldownMs: 0 }),
});
interface ActiveVoice { readonly audio: HTMLAudioElement; readonly cue: ApprovedCue; readonly priority: AudioPriority; readonly sequence: number }

export class CampaignAudio {
  private readonly stageComplete = new Audio('/audio/stage1/stage_complete_a.wav');
  private readonly pickup = new Audio('/audio/stage1/pickup-mouth-pop.wav');
  private readonly action = new Audio('/audio/stage1/deposit_small_latch.wav');
  private unlocked = false;
  private volume = 0.35;
  private muted = false;
  private activeVoices: ActiveVoice[] = [];
  private voiceSequence = 0;
  constructor() {
    for (const audio of [this.stageComplete, this.pickup, this.action]) audio.preload = 'auto';
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<CampaignAudioSettings & LegacyCampaignAudioSettings> | null;
      if (parsed !== null && this.validStoredVolume(parsed.volume) && typeof parsed.muted === 'boolean') {
        this.volume = parsed.volume; this.muted = parsed.muted;
      } else if (parsed !== null && this.validStoredVolume(parsed.masterVolume) && typeof parsed.masterMuted === 'boolean') {
        this.volume = parsed.masterVolume; this.muted = parsed.masterMuted; this.persist();
      }
    } catch { /* storage is optional */ }
  }
  unlock(): void { this.unlocked = true; }
  play(events: readonly CampaignEvent[]): void {
    for (const event of events) {
      if (event.type === 'stage-cleared') this.playCue('stage-clear');
    }
  }
  playCue(cue: CampaignAudioCue): void {
    if (!this.unlocked || this.muted || this.volume <= 0) return;
    const approved = cue === 'stage-clear' || cue === 'material-pickup' || cue === 'bread-submitted' ? cue : null;
    const template = approved === 'stage-clear' ? this.stageComplete : approved === 'material-pickup' ? this.pickup : approved === 'bread-submitted' ? this.action : null;
    if (template === null) return;
    const definition = APPROVED_CUES[approved!]; this.pruneVoices();
    if (definition.concurrencyGroup === 'deposit') this.stopOldest((voice) => voice.cue === 'bread-submitted');
    if (approved === 'material-pickup' && this.activeVoices.filter((voice) => voice.cue === approved).length >= 2) this.stopOldest((voice) => voice.cue === approved);
    while (this.activeVoices.length >= 6) {
      const victim = this.activeVoices.filter((voice) => this.priorityRank(voice.priority) >= this.priorityRank(definition.priority)).sort((left, right) => left.sequence - right.sequence)[0];
      if (victim === undefined) return; this.stopVoice(victim);
    }
    const voice = template.cloneNode(true) as HTMLAudioElement;
    voice.volume = this.volume * 10 ** (definition.gainDb / 20); voice.currentTime = 0;
    const active: ActiveVoice = { audio: voice, cue: approved!, priority: definition.priority, sequence: ++this.voiceSequence };
    this.activeVoices.push(active); voice.addEventListener?.('ended', () => this.removeVoice(active), { once: true });
    void voice.play().catch(() => undefined);
  }
  settings(): CampaignAudioSettings { return Object.freeze({ volume: this.volume, muted: this.muted }); }
  setVolume(volume: number): void { if (Number.isFinite(volume)) { this.volume = Math.min(1, Math.max(0, volume)); this.persist(); } }
  setMuted(muted: boolean): void { this.muted = muted; this.persist(); }
  dispose(): void { for (const voice of [...this.activeVoices]) this.stopVoice(voice); for (const audio of [this.stageComplete, this.pickup, this.action]) audio.pause(); this.unlocked = false; }
  private persist(): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings())); } catch { /* optional */ } }
  private validStoredVolume(value: unknown): value is number { return Number.isFinite(value) && (value as number) >= 0 && (value as number) <= 1; }
  private priorityRank(priority: AudioPriority): number { return priority === 'p0' ? 0 : 1; }
  private pruneVoices(): void { this.activeVoices = this.activeVoices.filter((voice) => !voice.audio.ended); }
  private stopOldest(predicate: (voice: ActiveVoice) => boolean): void {
    const voice = this.activeVoices.filter(predicate).sort((left, right) => left.sequence - right.sequence)[0]; if (voice !== undefined) this.stopVoice(voice);
  }
  private stopVoice(voice: ActiveVoice): void { try { voice.audio.pause(); } catch { /* already closed */ } this.removeVoice(voice); }
  private removeVoice(voice: ActiveVoice): void { const index = this.activeVoices.indexOf(voice); if (index >= 0) this.activeVoices.splice(index, 1); }
}
