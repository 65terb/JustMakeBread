import { afterEach, describe, expect, it } from 'vitest';
import { CampaignAudio, type CampaignAudioCue } from './CampaignAudio';

class AudioProbe {
  static played: string[] = [];
  static playedVolumes: number[] = [];
  static paused: string[] = [];
  ended = false;
  preload = ''; volume = 0; currentTime = 0;
  constructor(readonly src = '') {}
  cloneNode(): AudioProbe { return new AudioProbe(this.src); }
  play(): Promise<void> { AudioProbe.played.push(this.src); AudioProbe.playedVolumes.push(this.volume); return Promise.resolve(); }
  pause(): void { AudioProbe.paused.push(this.src); }
}

const install = (stored: string | null): { writes: string[] } => {
  const writes: string[] = [];
  Object.assign(globalThis, {
    Audio: AudioProbe,
    localStorage: { getItem: () => stored, setItem: (_key: string, value: string) => writes.push(value) },
  });
  AudioProbe.played = []; AudioProbe.playedVolumes = []; AudioProbe.paused = [];
  return { writes };
};

afterEach(() => { delete (globalThis as { Audio?: unknown }).Audio; delete (globalThis as { localStorage?: unknown }).localStorage; });

describe('CampaignAudio approved boundary', () => {
  it('plays only pickup, bread submission, and stage-clear approved cues', () => {
    install(null); const audio = new CampaignAudio(); audio.unlock();
    const cues: CampaignAudioCue[] = ['material-pickup', 'material-drop', 'material-intake', 'process-start', 'process-complete',
      'material-output', 'bread-submitted', 'stage-clear', 'game-over', 'module-reveal', 'module-pickup', 'module-attach', 'module-detach', 'module-drop'];
    for (const cue of cues) audio.playCue(cue);
    expect(AudioProbe.played).toEqual(['/audio/stage1/pickup-mouth-pop.wav', '/audio/stage1/deposit_small_latch.wav', '/audio/stage1/stage_complete_a.wav']);
  });

  it('reads both schemas and migrates only a valid legacy record once', () => {
    let storage = install(JSON.stringify({ masterVolume: 0.62, masterMuted: true }));
    let audio = new CampaignAudio(); expect(audio.settings()).toEqual({ volume: 0.62, muted: true });
    expect(storage.writes).toEqual([JSON.stringify({ volume: 0.62, muted: true })]);
    storage = install(JSON.stringify({ volume: 0.41, muted: false })); audio = new CampaignAudio();
    expect(audio.settings()).toEqual({ volume: 0.41, muted: false }); expect(storage.writes).toEqual([]);
    storage = install(JSON.stringify({ masterVolume: 'bad', masterMuted: false })); audio = new CampaignAudio();
    expect(audio.settings()).toEqual({ volume: 0.35, muted: false }); expect(storage.writes).toEqual([]);
  });

  it('retains approved gain and concurrency behavior with zero cooldown', () => {
    install(null); const audio = new CampaignAudio(); audio.unlock();
    audio.playCue('material-pickup'); audio.playCue('material-pickup'); audio.playCue('material-pickup');
    expect(AudioProbe.played).toHaveLength(3); expect(AudioProbe.playedVolumes[0]).toBeCloseTo(0.35 * 10 ** (-10 / 20), 10);
    expect(AudioProbe.paused).toEqual(['/audio/stage1/pickup-mouth-pop.wav']);
    audio.playCue('bread-submitted'); audio.playCue('bread-submitted');
    expect(AudioProbe.played.filter((source) => source.endsWith('deposit_small_latch.wav'))).toHaveLength(2);
    expect(AudioProbe.paused.filter((source) => source.endsWith('deposit_small_latch.wav'))).toHaveLength(1);
  });
});
